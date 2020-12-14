var SUCCESS = "success",
    FEEDBACK = "feedback",
    ADD_DOMAIN = "add-domain",
    FIELDSET_CONTAINER = "fieldset-container",
    ERROR = "error";

var VALID = "valid",
    INVALID = "invalid";

var AUTHOR_NAME = "author-url",
    PUBLISHED_NAME = "published-url";

var fieldCount = 0;

function showSaveFeedback(sites,isSuccess=true,showCheckMark=true) {
  if (showCheckMark) {
    let success = document.getElementById(SUCCESS);
    success.classList.remove("hidden");
    setTimeout(()=>{
      success.classList.add("hidden");
    },500);
  }
  document.getElementById(FEEDBACK).textContent = `Saved (${sites.length}). `;
}


function getCheckBoxValues(name,parent) {
  var values = [];

  if (typeof parent==="undefined") {
    parent = document;
  }
  parent.querySelectorAll(`input[type='checkbox'][name=${name}]`)
    .forEach(function(element) {
      if (element.checked && !element.disabled) {
        values.push(element.value);
      }
  });
  return values;  
}

function unsaveSite(siteObj) {
  BROWSER_STORAGE.get()
    .then((data) => {
      if (typeof data.sites !== "undefined" && Array.isArray(data.sites)) {
        BROWSER_STORAGE.set({
          sites:data.sites.filter(function(val,index,arr) {
            return val.id!==siteObj.id;
          })
        })
      }
      document.getElementById(FEEDBACK).textContent = `Removed element`; 
    })
    .catch((error) => {
      document.getElementById(ERROR).classList.toggle("hidden");
      console.error(`Error ${error}`);
    });
}

function removeFieldset(e,fieldset) {
  if (typeof fieldset==="undefined") {
    fieldset = e.target.closest("fieldset.card");
  }
  unsaveSite(fieldsetToSiteObj(fieldset));
  e.target.closest("fieldset.card").remove();
}

function fillCheckBoxValues(name,values,parent) {
  if (typeof parent==="undefined") {
    parent = document;
  }
  parent.querySelectorAll(`input[type='checkbox'][name=${name}]`)
    .forEach(function(element) {
      element.checked = false;
      if (values.includes(element.value)) {
        element.checked = true;
      }
  }); 
}

function siteObjToFieldset(fieldset,siteObj) {
  fieldset.querySelector("[name='id']").value = siteObj.id;
  fieldset.querySelector("[name='name']").value = siteObj.name || "";
  fieldset.querySelector(`[name='${AUTHOR_NAME}']`).value =  siteObj.author || "";
  fieldset.querySelector(`[name='${PUBLISHED_NAME}']`).value =  siteObj.published || "";
  // fieldset.querySelector("[name='enabled']").checked = siteObj.enabled || false;
  fillCheckBoxValues("context-menu",siteObj.contextMenu,fieldset);
}

function fieldsetToSiteObj(fieldset) {
  var siteObj = {}; // no I don't care this is lazy
  siteObj.id = parseInt(fieldset.querySelector("[name='id']").value);
  siteObj.name = fieldset.querySelector("[name='name']").value;
  siteObj.author = fieldset.querySelector(`[name='${AUTHOR_NAME}']`).value;
  siteObj.published = fieldset.querySelector(`[name='${PUBLISHED_NAME}']`).value;
  // siteObj.enabled = fieldset.querySelector("[name='enabled']").checked;
  siteObj.enabled = true; // this will be implemented later
  siteObj.contextMenu = getCheckBoxValues("context-menu",fieldset);
  return siteObj;
}

function updateSiteCheckboxes(fieldset) {
  var authorInput = fieldset.querySelector(`[name='${AUTHOR_NAME}']`),
      websiteInput = fieldset.querySelector(`[name='${PUBLISHED_NAME}']`);
  fieldset.querySelectorAll("[name='context-menu']").forEach((ele)=>{ele.disabled = true});
  if (authorInput && authorInput.value.trim()) {
    fieldset.querySelectorAll(`[value='${AUTHOR}']`).forEach((ele)=>{ele.disabled = false});
    fieldset.querySelectorAll(`[value='${PREVIEW}']`).forEach((ele)=>{ele.disabled = false});;
  }
  if (websiteInput && websiteInput.value.trim()) {
    fieldset.querySelectorAll(`[value='${PUBLISHED}']`).forEach((ele)=>{ele.disabled = false});;
  }
}

function saveSite(fieldset,sites) {
  var siteObj = fieldsetToSiteObj(fieldset);
  function updateSites(sites,siteObj) {
    var updated = false;
    for (var i=0;i<sites.length;i++) {
      if (sites[i].id===siteObj.id) {
        sites[i]=siteObj;
        updated = true;
        break
      }
    }
    if (!updated && siteObj.name.trim()) {
      sites.push(siteObj);
    }
    return sites
  }
  if (typeof sites === "undefined") {
    BROWSER_STORAGE.get() 
    .then((data)=> {
      if (typeof data.sites !== "undefined" && Array.isArray(data.sites)) {
        let sites = updateSites(data.sites,siteObj);        
        BROWSER_STORAGE.set({
          sites:sites
        })
        .then(()=>{
          return browser.runtime.sendMessage({updated:true});
        })
        .then(()=>{
          showSaveFeedback(sites,true,false);
        });
      }
    })
    .catch((err)=>{
      console.error(err);
    })
  } else {
    let sites = updateSites(sites,siteObj);
    BROWSER_STORAGE.set({
      sites:sites
    })
    .then(()=>{
      return browser.runtime.sendMessage({updated:true});
    })
    .then(()=>{
      showSaveFeedback(sites,true,false);
    });
  }
}

function addFieldset(e,siteObj) {
  // e.preventDefault();
  if (e && e.which!==1) {//left mouse button
    return;
  }
  var fieldsetClone;
  if (typeof siteObj!=="undefined" && siteObj.id>fieldCount){
    fieldCount=siteObj.id;
  }
  fieldsetClone = document.getElementById(TEMPLATE).cloneNode(true);
  fieldsetClone.setAttribute("name","domain-"+fieldCount);
  fieldsetClone.querySelector("[name='id']").value = `${fieldCount}`;
  fieldsetClone.querySelector("[name='delete']").addEventListener("click",removeFieldset);
  fieldsetClone.disabled = false;
  fieldsetClone.removeAttribute("id");

  if (typeof siteObj!=="undefined") {
    // if the fieldset is being loaded from data (ie saved settings),
    // populate the fields
    siteObjToFieldset(fieldsetClone,siteObj);
  }
  updateSiteCheckboxes(fieldsetClone);
  fieldsetClone.querySelectorAll("input").forEach((input)=>{
    input.addEventListener("input",(evt)=>{
      // note this validation is visual only
      // hahahaha.. ha.. ha.. ha.. ha..... pls end my pain
      if (input.name===AUTHOR_NAME) {
        if (input.value.trim() && new AEMUrl(input.value).isAuthor()) {
          input.classList.remove(INVALID);
          input.classList.add(VALID);
        } else {
          input.classList.remove(VALID);
          input.classList.add(INVALID);          
        }
      } else if (input.name===PUBLISHED_NAME) {
        if (input.value.trim() && new AEMUrl(input.value).isPublished()) {
          input.classList.remove(INVALID);
          input.classList.add(VALID);
        } else {
          input.classList.remove(VALID);
          input.classList.add(INVALID);          
        }        
      }
    });
    input.addEventListener("blur",(evt)=>{
      var fieldset = evt.target.closest("fieldset.card");
      updateSiteCheckboxes(fieldset);
    });
  })
  document.getElementById(FIELDSET_CONTAINER).appendChild(fieldsetClone);
  fieldCount += 1;
}

document.addEventListener("DOMContentLoaded",()=>{
  BROWSER_STORAGE.get()
  .then((data) => {
    if (typeof data.sites !== "undefined" && Array.isArray(data.sites)) {
      for (var i=0;i<data.sites.length;i++) {
        addFieldset(undefined,data.sites[i]);
      }
      if (i<1) { // if there are not any cards visible, add one
        addFieldset();
      }
      document.getElementById(FEEDBACK).textContent = `Loaded settings: ${data.sites.length}, ${fieldCount}`;
    }
  })
  .catch((error) => {
    document.getElementById(ERROR).classList.toggle("hidden");
    console.error(`Error ${error}`);
  });
});

document.querySelector("form#options").addEventListener("submit",(e)=>{
  e.preventDefault();
  var sites = [];
  var siteObj;
  var fieldsets = document.getElementById(FIELDSET_CONTAINER).querySelectorAll("fieldset[name]");
  for (var i=0;i<fieldsets.length;i++){
    siteObj = fieldsetToSiteObj(fieldsets[i]);
    if (siteObj.name.trim()) {
      sites.push(siteObj);
    }
  }
  BROWSER_STORAGE.set({
    sites:sites
  })
  .then(()=>{
    return browser.runtime.sendMessage({updated:true});
  })
  .then(()=>{
    showSaveFeedback(sites);
  });
});

document.querySelectorAll("input").forEach((input)=>{
  input.addEventListener("blur",()=>{
    var fieldset = e.target.closest("fieldset.card");
    saveSite(fieldset);
  })
})

document.getElementById(ERROR).querySelector("button.close").addEventListener("click",(e)=>{
  e.preventDefault();
  e.target.closest(".notification").style.display="none";
});

document.getElementById(ADD_DOMAIN).addEventListener("click",addFieldset);