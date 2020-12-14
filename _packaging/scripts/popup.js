var CONTAINER_ID = "container",
    CARD_NAME_ELEMENT = ".header>span.name";

var SETTINGS_ID  = "settings",
    LOCK = "lock";

var TOGGLE_CLASS = "options-toggle",
    OPTIONS = "options",
    OPEN = "open";

var ENABLED_ATTRIBUTE = "data-enabled",
    DISABLED_ATTRIBUTE = "data-disabled";

var envButtons=[];


function setLockButtonState(lockStatus) {
  if (lockStatus) {
    for (var i=0;i<envButtons.length;i++) {
        envButtons[i].disabled=true;
    }
  } else {
    for (var i=0;i<envButtons.length;i++) {
        envButtons[i].disabled=false;
    }
  }
}

function getLockListener(siteId,lockEle,env){
  return (evt)=>{
    BROWSER_STORAGE.get()
    .then(async (data)=>{
      if (typeof data.lockEnv!=="undefined") {
        if (data.lockEnv) {
          BROWSER_STORAGE.set({
            lockEnv:null,
            lockId:null
          }).then(()=>{
            setLockButtonState(!data.lockEnv);
          })
        } else {
          BROWSER_STORAGE.set({
            lockEnv:env,
            lockId:siteId
          })
          .then(()=>{
            // we have already toggled it in storage,
            // so need to also invert what we displayed
            // (the value we retrieved is out of date)
            setLockButtonState(!data.lockEnv);
            if (lockEle) {
              lockEle.classList.remove(HIDDEN);
            }
          })
        }
      }
    })
    .catch((err)=>{
      console.error(err);
    })
  }
}

async function buildCard(site,data) {
  var currentEnv = "",
      template,lockEle,tabs,tabUrlObj;

  // get new card element to fill with values
  template = document.getElementById(TEMPLATE).cloneNode(true);
  template.querySelector(CARD_NAME_ELEMENT).textContent = site.name || "[Error: Name not found]";
  template.removeAttribute("id");

  // tabs query is so that we can change the URL of the current tab
  tabs = await browser.tabs.query({active:true,currentWindow:true})
  tabUrlObj = new AEMUrl(tabs[0].url);

  // Bind toggle button (to show/hide hidden buttons)
  Array.from(template.getElementsByClassName(TOGGLE_CLASS)).forEach((toggle)=>{
    var toggleImg = toggle.querySelector("img"),
        options = template.getElementsByClassName(OPTIONS)[0];
    toggle.showing=false; // create a 'showing' attribute to track the state of the toggle
    toggle.addEventListener("click",(e)=>{
      options.classList.toggle(OPEN);
      if (toggle.showing===true) {
        toggleImg.src = toggleImg.getAttribute(ENABLED_ATTRIBUTE);
        toggle.showing = false;
      } else if (toggle.showing===false) {
        toggleImg.src = toggleImg.getAttribute(DISABLED_ATTRIBUTE);
        toggle.showing = true;
      }
    });
  });
  // Bind lock button (to reset the lock status after the extension is locked)
  Array.from(template.getElementsByClassName(LOCK)).forEach((lock)=>{
    // we need to save one lock button (there should only be one)
    // so we save the last one
    lockEle = lock; 
    lock.addEventListener("click",(e)=>{
      if (!lock.classList.contains(HIDDEN)) {
        BROWSER_STORAGE.set({
          lockEnv:null,
          lockId:null
        })
        .then(()=>{
          lock.classList.toggle(HIDDEN);
          setLockButtonState(false);
        })
        .catch((err)=>{
          console.error(err);
        });
      }
    })
  });

  // get current environment (used to change environments below)
  for (const site of data.sites) {
    if (tabUrlObj.isSubpageOf(site.author)) {
      currentEnv = site.author;
      break;
    } else if (tabUrlObj.isSubpageOf(site.published)) {
      currentEnv = site.published;
      break;
    }
  }

  // Bind environment-based buttons ("Author"/"Preview"/"Published")
  template.querySelectorAll("button").forEach((button) => {
    switch (button.value) {
      case AUTHOR:
      case PREVIEW:
        if (site.author) {
          envButtons.push(button);
          if (button.name===OPEN) {
            button.addEventListener("click",(e)=>{
              var parsedDest = tabUrlObj.changeEnvironment(currentEnv,site.author || currentEnv);
              if (site.newTab) {
                browser.tabs.create({active:true,url:parsedDest.setPreview(false).href});
              } else {
                browser.tabs.update({url:parsedDest.setPreview(button.value===PREVIEW).href});
              }
            });
          } else if (button.name===LOCK) {
            if (button.value===PREVIEW) {
              button.addEventListener("click",
                getLockListener(site.id,lockEle,new AEMUrl(site.author).setPreview(true).href) || currentEnv);
            } else {
              button.addEventListener("click",
                getLockListener(site.id,lockEle,new AEMUrl(site.author).setPreview(false).setAuthor(true).href) || currentEnv);
            }
          }
        } else {
          button.disabled = true;
          button.classList.toggle(HIDDEN);
        }
        break;
      case PUBLISHED:
        if (site.published) {
          envButtons.push(button);
          if (button.name===OPEN) {
            button.addEventListener("click",(e)=>{
              var parsedDest = tabUrlObj.changeEnvironment(currentEnv,site.published || currentEnv);
              // parsedDest.setPreview(false);
              if (site.newTab) {
                browser.tabs.create({active:true,url:parsedDest.setPreview(false).href});
              } else {
                browser.tabs.update({url:parsedDest.setPreview(false).href});
              }
            });
          } else if (button.name===LOCK) {
            button.addEventListener("click",
              getLockListener(site.id,lockEle,new AEMUrl(site.published || currentEnv).href));
          }
        } else {
          button.disabled = true;
          button.classList.toggle(HIDDEN);
        }
        break;
    }
  });
  return new Promise((resolve)=>{
    resolve(template);
  })
}

// create cards from storage
BROWSER_STORAGE.get()
.then(async (data) => {
  var card;
  if (typeof data.sites !== "undefined" && Array.isArray(data.sites)) {
    for (var i=0;i<data.sites.length;i++) {
      card = await buildCard(data.sites[i],data);
      if (data.lockId!=null && data.lockId===data.sites[i].id) {
        Array.from(card.getElementsByClassName(LOCK)).forEach((lock)=>{
          lock.classList.remove(HIDDEN);
        })
      }
      document.getElementById(CONTAINER_ID).appendChild(card);
    }
    setLockButtonState(data.lockEnv);
  }
})
.catch((error) => {
  console.error(`Error ${error}`);
});

// add options button
document.getElementById(SETTINGS_ID).addEventListener("click",(e)=>{
  browser.runtime.openOptionsPage();
})