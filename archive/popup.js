var CONTAINER_ID = "container",
    HEADER_ELEMENT = ".header",
    CARD_NAME_ELEMENT = ".header>span.name";

var SETTINGS_ID  = "settings",
    OUTLINE_ID = "outline",
    ENV_LABEL_ID = "show-bar",
    NOCACHE_ID = "disable-cache",
    LOCK = "lock";

var TOGGLE_CLASS = "options-toggle",
    ENABLED_CLASS = "active",
    OPTIONS = "options",
    OPEN = "open";

var ENABLED_ATTRIBUTE = "data-enabled",
    DISABLED_ATTRIBUTE = "data-disabled";

var CSS_OUTLINE_FILE = "/styles/outline-components.css";

var EXPANDO_LOCK_ID = "lock",
    EXPANDO_NEW_TAB_ID = "newTab",
    EXPANDO_LOCK_CLOSED_IMG = "icons/svg/lock-closed.svg",
    EXPANDO_LOCK_OPEN_IMG = "icons/svg/lock-open.svg",
    EXPANDO_HTML = `<div class="expando">
      <div class="inline-group actions">
        <!--<span>
          <button type="button" class="button" id="${EXPANDO_LOCK_ID}" title="Lock all pages to current environment" disabled>
            <img src="icons/svg/lock-open.svg" alt="lock icon" aria-hidden="true">
          </button>
        </span>-->
        <span>
          <button type="button" class="button" id="${EXPANDO_NEW_TAB_ID}" title="Open in new tab">
            <img src="icons/svg/new-tab.svg" alt="new tab icon" aria-hidden="true">
          </button>
        </span>
      </div>
    </div>`


// var envButtons=[];

async function getCurrentTab() {
  // tabs query is so that we can change the URL of the current tab
  tabs = await browser.tabs.query({active:true,currentWindow:true})
  console.assert(tabs.length==1,"More than one active tab found");
  return tabs[0];
}

// function setLockButtonState(lockStatus) {
//   for (var i=0;i<envButtons.length;i++) {
//       envButtons[i].disabled=!!lockStatus;
//   }
// }

function setButtonState(button,enabledStatus) {
  if (enabledStatus) { // this is backwards bc it will be toggled below
    button.classList.add(ENABLED_CLASS);
  } else {
    button.classList.remove(ENABLED_CLASS);
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
            lockCardId:null
          }).then(()=>{
            // setLockButtonState(null);
          })
        } else {
          BROWSER_STORAGE.set({
            lockEnv:env,
            lockCardId:siteId
          })
          .then(()=>{
            // we have already toggled it in storage,
            // so need to also invert what we displayed
            // (the value we retrieved is out of date)
            // setLockButtonState(env);
            if (lockEle) {
              lockEle.classList.remove(HIDDEN);
            }
          })
        }
      }
    })
    .catch((error)=>{
      console.error(error);
    })
  }
}

function changeTabToEnvironment(changeData,targetEnvironmentUrl,openInNewTab,isPreview) {
  // changeData => {
  //   tabUrl: <AEMUrl>,
  //   envUrl: <AEMUrl>|string,
  // }

  if (!changeData) {
    console.error("Invalid argument supplied. 'card' must have 'environments' attribute.");
    return;
  }
  var parsedAemUrl = changeData.tabUrl.changeEnvironment(changeData.envUrl,targetEnvironmentUrl);
  if (openInNewTab) {
    browser.tabs.create({active:true,url:parsedAemUrl.setPreview(isPreview).href});
  } else {
    browser.tabs.update({url:parsedAemUrl.setPreview(isPreview).href});
  }
}

// EXPANDO
// ###################################################################
function buildExpando(button,card,targetEnvironmentUrl){ 
  var expando = htmlToElement(EXPANDO_HTML),
      lockButton,newTabButton;

  expando.card = card;
  newTabButton = expando.querySelector("#"+EXPANDO_NEW_TAB_ID);
  newTabButton.addEventListener("click",(evt)=>{
    changeTabToEnvironment(card.environments,targetEnvironmentUrl,true,button.value===PREVIEW); // PREVIEW shouldn't be hard coded like this
  });  
  return expando;
}

function closeExpando(expando) {
  if (expando.card) {
    expando.button.classList.remove(ENABLED_CLASS);
    expando.card.removeChild(expando);
    expando.card.expando = undefined; // P R O G R A M M I N G
    expando.card = undefined;
  }
} 

function toggleExpando(button,card,targetEnvironmentUrl) {
  var newExpando;
  if (card.expando && card.expando.button===button) {
      closeExpando(card.expando);
      // card.expando.button=button;
      // button.classList.add(ENABLED_CLASS);
  } else {
    if (card.expando) {
      card.expando.button.classList.remove(ENABLED_CLASS);
      card.removeChild(card.expando);
    }
    newExpando = buildExpando(button,card,targetEnvironmentUrl);
    newExpando.button = button;
    card.expando = newExpando;
    button.classList.add(ENABLED_CLASS);
    card.appendChild(newExpando);
  }  
}

// CARDS
// ###################################################################
function bindEvironmentButton(button,card,targetEnvironmentUrl) {
  if (targetEnvironmentUrl) {
    // button.environment = new AEMUrl(targetEnvironmentUrl).setPreview(button.value===PREVIEW).href;
    button.addEventListener("click",(e)=>{
      changeTabToEnvironment(card.environments,targetEnvironmentUrl,false,button.value===PREVIEW); // PREVIEW shouldn't be hard coded like this
    });
  } else {
    button.disabled = true;
    // button.environment = null;
  }
}

function bindExpandoButton(button,card,targetEnvironmentUrl) {
  if (targetEnvironmentUrl) {
    button.addEventListener("click",(e)=>{
      toggleExpando(button,card,targetEnvironmentUrl);
    });
  } else {
    button.disabled = true;
  }
}

function buildCard(site,tabEnvName,data,tabUrlObj) {
  var template,lockEle,tabs;

  // get new card element to fill with values
  template = document.getElementById(TEMPLATE).cloneNode(true);
  template.querySelector(CARD_NAME_ELEMENT).textContent = site.name || "[Error: Name not found]";
  template.querySelector(HEADER_ELEMENT).style.setProperty(CSS_COLOR_PROPERTY,site.color);
  template.removeAttribute("id");

  template.environments = {
    tabUrl: tabUrlObj,
    envUrl: tabEnvName,
    site: site
  }

  // Bind environment-based buttons ("Author"/"Preview"/"Published")
  template.querySelectorAll("button").forEach((button) => {
    switch (button.value) {
      case AUTHOR:
      case PREVIEW:
        if (button.name===OPEN) {
          bindEvironmentButton(button,template,site.author);
        } else if (button.name===OPTIONS) {
          bindExpandoButton(button,template,site.author);
        }
        break;
      case PUBLISHED:
        if (button.name===OPEN) {
          bindEvironmentButton(button,template,site.published);
        } else if (button.name===OPTIONS) {
          bindExpandoButton(button,template,site.published);
        }
        break;
    }
  });
  return template;
}

// for use with the 'outline' button
async function toggleOutline(evt) {
  var currentTarget=evt.currentTarget,
      tabId;
  tabId = (await getCurrentTab()).id;
  if (!tabId) {
    // even though we are returning here
    // this is not an error as tabs such as
    // the developer window will not return
    // an Id, and are still expected
    console.warn(`Tab ID not found`);
    return;
  }
  BROWSER_STORAGE.get()
  .then((data)=>{
    if (data.outlinedTabs.includes(tabId)) {
      browser.tabs.removeCSS({
        file: CSS_OUTLINE_FILE
      })
      .catch((error)=>{
        console.error(error);
      });
      data.outlinedTabs.splice(data.outlinedTabs.indexOf(tabId),1);
      setButtonState(currentTarget,false);
    } else {
      browser.tabs.insertCSS({
        file:CSS_OUTLINE_FILE
      })
      .catch((error)=>{
        console.error(error);
      });
      data.outlinedTabs.push(tabId);
      setButtonState(currentTarget,true);
    }
    BROWSER_STORAGE.set({
      outlinedTabs: data.outlinedTabs
    })
    .catch((error)=>{console.error(error)});
  })
  .catch((error)=>{console.error(error)});
}

async function disableCache(evt) {
  var disableCacheParam="_dc",
      nDigits=12,
      url,parsedUrl;
  url = (await getCurrentTab()).url;
  if (!url) {
    console.warn("Unable to retrieve URL search parameters: invalid URL");
    return;
  }
  parsedUrl = new URL(url);
  // set the cachebusting  param to a random 6 digit integer
  parsedUrl.searchParams.set(disableCacheParam,Math.trunc(Math.random()*(10**nDigits)).toString());
  browser.tabs.update({url:parsedUrl.toString()});
}

// ================ BODY ================

// create cards from storage
BROWSER_STORAGE.get()
.then(async (data) => {
  // set tabEnvName and tabUrlObj
  var tab=await getCurrentTab(),
      tabUrlObj = new AEMUrl(tab.url),
      tabEnvName,card;
  for (const site of data.sites) {
    if (tabUrlObj.isSubpageOf(site.author)) {
      tabEnvName = site.author;
      break;
    } else if (tabUrlObj.isSubpageOf(site.published)) {
      tabEnvName = site.published;
      break;
    }
  }

  if (typeof data.sites !== "undefined" && Array.isArray(data.sites)) {
    for (var i=0;i<data.sites.length;i++) {
      card = buildCard(data.sites[i],tabEnvName,data,tabUrlObj);
      if (data.lockCardId!=null && data.lockCardId===data.sites[i].id) {
        Array.from(card.getElementsByClassName(LOCK)).forEach((lock)=>{
          lock.classList.remove(HIDDEN);
        })
      }
      document.getElementById(CONTAINER_ID).appendChild(card);
    }
    setButtonState(document.getElementById(ENV_LABEL_ID),data.showEnvLabels);
    setButtonState(document.getElementById(OUTLINE_ID),data.outlinedTabs.includes(tab.id));
    // setLockButtonState(data.lockEnv);
  }
})
.catch((error) => {
  console.error(error);
});

// add options button
document.getElementById(SETTINGS_ID).addEventListener("click",(e)=>{
  browser.runtime.openOptionsPage();
});

document.getElementById(OUTLINE_ID).addEventListener("click", (evt)=>{
  toggleOutline(evt);
})

document.getElementById(NOCACHE_ID).addEventListener("click",(evt)=>{
  disableCache(evt);
})

document.getElementById(ENV_LABEL_ID).addEventListener("click",(evt)=>{
  var currentTarget = evt.currentTarget;
  BROWSER_STORAGE.get()
  .then((data)=>{
    setButtonState(currentTarget,!data.showEnvLabels);
    BROWSER_STORAGE.set({
      showEnvLabels:!data.showEnvLabels || false
    });
  });
})
