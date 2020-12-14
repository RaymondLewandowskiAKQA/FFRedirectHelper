// import * as globals from "./globals.js";

// at the moment background.js does not allow module imports, 
// this is a awkward and only partially functional workaround
import("./globals.mjs").then((globals)=>{

  const CONTENT_SCRIPT_PATH = "/scripts/content-script.js",
        CONTENT_STYLE_PATH = "/styles/content-styles.css";

  const DEFAULT_SITE = {
    name:"Unknown",
    color:"#bbbbbb",
    id:-1
  }

  function getUndefinedVariableMap(obj,variableMap) {
    var undefinedVariableMap = {};
    for (var variable in variableMap) {
      if (typeof obj[variable]==="undefined") {
        console.log("Adding variable: ",variable);
        undefinedVariableMap[variable] = variableMap[variable];
      }
    }
    return undefinedVariableMap;
  }

  // initialize browser storage 
  globals.BROWSER_STORAGE.get()
  .then((data)=>{
    var uninitialized = getUndefinedVariableMap(data,{
      sites:[],
      outlinedTabs:[],
      lockEnv:null,
      lockCardId:null,
      showEnvLabels:false,
      envLabelCSS:""
    });
    return globals.BROWSER_STORAGE.set(uninitialized);
  })
  .catch((error)=>{
    console.error(error);
  });

  // probably a cleaner way to do this, but this initializes
  // variables that should be reset every time the browser restarts
  globals.BROWSER_STORAGE.set({
    lockEnv:null,
    outlinedTabs:[]
  })
  .catch((error)=>{
    console.error(error);
  });

  // ==============================//
  //     FUNCTION DEFINITIONS      //
  // ==============================//

  function getContextId(site,suffix) {
    // generate a unique identifier for a provided context menu item

    // remove all non-alphanumeric characters from site name 
    // and append site id
    var base = `${site.name.replace(/[^a-z0-9]/gi,"")}-${site.id}`;
    return suffix ? `${base}-${suffix}` : base;
  }

  function getSiteContextLabel(site) {
    return `Open in ${site.name}`;
  }

  function getSite(url,data) {
    var isMatchingDomain = false
    url = new globals.AEMUrl(url);
    for (var site of data.sites) {
      if (url.isSubpageOf(site.author) || url.isSubpageOf(site.published)) {
        return site
      } 
      if (url.domain === new globals.AEMUrl(site.author).domain || url.domain === new globals.AEMUrl(site.published).domain) {
        isMatchingDomain = true;
      }
    }
    return isMatchingDomain;
  }

  function getContextClickListener(destUrl,isPreview) {
    return function(info,tab) {
      var parsedSrcUrl = new globals.AEMUrl(info.linkUrl),
          currentEnv = "",
          parsedDest;

      // get the context menu item that was clicked
      // -------
      // unfortunately, a drawback of this design is that every 
      // registered URL must be parsed in order to open the link. 
      // In the future I might look into a refactor to change this
      // find the matching url
      // TODO ALL globals.BROWSER_STORAGE CALLS REALLY NEED TO BE MINIMISED,
      // refactor likely required
      globals.BROWSER_STORAGE.get()
      .then((data)=>{
        for (const site of data.sites) {
          if (parsedSrcUrl.isSubpageOf(site.author)) {
            currentEnv = site.author;
            break;
          } else if (parsedSrcUrl.isSubpageOf(site.published)) {
            currentEnv = site.published;
            break;
          }
        }
        console.log("Context changing from "+currentEnv+" to "+destUrl);
        parsedDest = parsedSrcUrl.changeEnvironment(currentEnv,destUrl);
        if (isPreview) {
          parsedDest.setPreview();
        }
        browser.tabs.create({
          url:parsedDest.href,
          active: true
        });
      })
      .catch((error)=>{
        console.error(error);
      });
    }
  }

  function createBrowserContextItem(site,envName,url,isPreview,label) {
    var contextMenuInfo = {
      id: getContextId(site,envName),
      title: label,
      onclick: getContextClickListener(url,isPreview),
      contexts: ["link"]
    };
    if (envName) {
      contextMenuInfo.parentId = getContextId(site);
    }
    browser.contextMenus.create(contextMenuInfo);
  }

  function contextMenuFromSite(site,contextMenuMap) {
    var itemsToShow;
    if (site.enabled) {
      itemsToShow = site.contextMenu.filter(env=>env).map(env=>env.toLowerCase());
      if (itemsToShow.length>1) {
        browser.contextMenus.create({
          id: getContextId(site),
          title: getSiteContextLabel(site),
          contexts: ["link"]
        });
        for (let envName in contextMenuMap) {
          if (itemsToShow.includes(envName.toLowerCase())) {
            createBrowserContextItem(site,envName,
              contextMenuMap[envName].url,
              contextMenuMap[envName].isPreview,
              contextMenuMap[envName].label);
          }
        }
      } else if (itemsToShow.length>0) {
        createBrowserContextItem(site,null,
          itemsToShow.includes(globals.PUBLISHED) ? site.published : site.author,
          itemsToShow.includes(globals.PREVIEW),
          getSiteContextLabel(site)
        );
      }
    }
  }

  // CONTEXT MENUS ITEMS
  function updateContextMenuItems() {
    // it would be cleaner to do this on a per menu-item basis 
    // (ie update if exists, remove if not), but just removing and
    // re-creating everything is easier
    browser.contextMenus.removeAll()
    .then(()=>{
      return globals.BROWSER_STORAGE.get();
    }) 
    .then((data) => {
      if (typeof data.sites === "undefined" || !Array.isArray(data.sites)) {
        console.error("No sites found");
        return;
      }
      browser.contextMenus.refresh();
      data.sites.forEach((site)=>{
        contextMenuFromSite(site, {
          [globals.AUTHOR]: {
            "label":"Author",
            "url":site.author,
            "isPreview":false
          },
          [globals.PREVIEW]: {
            "label":"Preview",
            "url":site.author,
            "isPreview":true
          },
          [globals.PUBLISHED]: {
            "label":"Published",
            "url":site.published,
            "isPreview":false
          }
        });
      });
    })
    .catch((error)=>{
      console.error(error);
      console.error("An error has occured while retrieving settings.");
    });
  }

  function toggleEnvLabelCSS(tabId,showCSS) {
    globals.BROWSER_STORAGE.get()
    .then((data)=>{
      if (data.envLabelCSS) {
        if (showCSS) {
          // no I don't care about code injection, in theory the user 
          // should be the one adding the css anyway. If published on a 
          // larger scale, I may add a CSS property whitelist later 
          // (TODO)
          return browser.tabs.insertCSS(tabId,{
            code:data.envLabelCSS
          });
        } else {
          // nb this will fail if the CSS setting has been modified 
          // since the CSS was enabled in the tab. 
          // TODO: add a settings listener that will update all tabs' 
          // CSS before saving to fix this problem
          return browser.tabs.removeCSS(tabId,{
            code:data.envLabelCSS
          });
        }
      } else {
        return Promise.resolve();
      }
    })
  }


  // ==============================//
  //            MAIN               //
  // ==============================//

  updateContextMenuItems();


  // ==============================//
  //          LISTENERS            //
  // ==============================//

  // RUNTIME MESSAGE HANDLER
  browser.runtime.onMessage.addListener((request,sender,sendResponse)=>{
    if (request && request.type) {
      switch (request.type) {
        case "contextMenuItems":
          updateContextMenuItems();
          sendResponse({
            type:"feedback",
            data: {
              success:true
            }
          });
          break;
        case "toggleCSS":
          toggleEnvLabelCSS(sender.tab.id,request.data.showCSS);
          break;
        default:
          console.warn(`Received unexpected message type '${request.type}'`);
      }
    }
  });

  // SEARCH BAR ICON HANDLER
  browser.tabs.onUpdated.addListener((tabId,changeInfo,tab) => {
    if (changeInfo.status==="complete") {
      globals.BROWSER_STORAGE.get()
      .then((data)=>{
        var tabUrl,site;
        if (typeof data.sites !== "undefined" && Array.isArray(data.sites)) {
          tabUrl = new globals.AEMUrl(tab.url);
          site = getSite(tabUrl,data);
          if (site===false) {
            browser.pageAction.hide(tabId);
            return;
          }
          if (changeInfo.url) {
            console.log("Anchor change");
            browser.tabs.sendMessage(tab.id, {
              type: "tabUpdate",
              data: {
                site:site===true?DEFAULT_SITE:site
                // site:site
              }
            });
          } else {
            console.log("Page change");
            browser.tabs.insertCSS(tab.id,{
              file:CONTENT_STYLE_PATH
            })
            .then(()=>{
              return toggleEnvLabelCSS(tab.id,true);
            })
            .then(()=>{
              return browser.tabs.executeScript(tab.id,{
                file: CONTENT_SCRIPT_PATH
              });
            })
            .then((result)=>{
              browser.tabs.sendMessage(tab.id,{
                type:"tabUpdate",
                data: {
                  site:site===true?DEFAULT_SITE:site
                  // site:site
                }
              });
            })
            .catch((error)=>{
              console.error(error);
            });
          }
          if (site!==null) {
            console.log("Showing page action",tabId);
            browser.pageAction.show(tabId);
            return;
          }
          console.log(site);
        }
        browser.pageAction.hide(tabId);
      })
      .catch((error) => {
        browser.pageAction.hide(tabId);
        console.error(`Error ${error}`);
      });
    }
  });

  browser.tabs.onRemoved.addListener((tabId,removeInfo)=>{
    // we don't need to check if tabId is in outlinedTabs
    // set.prototype.delete runs successfully even if the item is not
    // contained in the set, and as long as it is removed if it exists
    // neither do we 
    globals.BROWSER_STORAGE.get()
    .then((data)=>{
      data.outlinedTabs.splice(data.outlinedTabs.indexOf(tabId),1);
      return globals.BROWSER_STORAGE.set({
        outlinedTabs: data.outlinedTabs
      });
    })
    .catch((error)=>{
      console.error(error);
    });
  });


  // handle theme changes
  browser.theme.onUpdated.addListener((info)=>{
    console.log(info);
  });

  // Redirect Handler
  browser.webRequest.onBeforeRequest.addListener(
    async function (requestDetails) {
      var data = await globals.BROWSER_STORAGE.get();
      if (requestDetails.tabId && data.outlinedTabs.includes(requestDetails.tabId)) {
        /* remove outline when navigating away from page */
        data.outlinedTabs.splice(data.outlinedTabs.indexOf(requestDetails.tabId),1);
        globals.BROWSER_STORAGE.set({
          outlinedTabs:data.outlinedTabs
        })
        .catch((error)=>{
          console.error(error);
        });
      }
      return {};
      /*
      if (data.lockEnv) {
        // if the user has locked AEM to an environment
        var parsedUrl = new globals.AEMUrl(requestDetails.url),
            parsedLockEnv = new globals.AEMUrl(data.lockEnv),
            currentEnv = "",
            parsedDest;
        if (parsedUrl.isSubpageOf(data.lockEnv) && parsedLockEnv && parsedLockEnv.isPreview()===parsedUrl.isPreview()) {
          // if we are already in the destination environment, don't 
          // redirect '{}' => take no action and continue request as 
          // normal
          return {};
        }
        for (const site of data.sites) {
          if (parsedUrl.isSubpageOf(site.author)) {
            currentEnv = site.author;
            break;
          } else if (parsedUrl.isSubpageOf(site.published)) {
            currentEnv = site.published;
            break;
          }
        }
        parsedDest = parsedUrl.changeEnvironment(currentEnv,data.lockEnv);
        return {
          redirectUrl: parsedDest.href
        }
      } else {
        // if we aren't locked into an environment, don't redirect
      } */
    },
    {urls: ["<all_urls>"],types:["main_frame"]},
    ["blocking"]
  );

  // uncomment this before publishing

  browser.runtime.onInstalled.addListener((details)=>{
    console.log(details);
    browser.runtime.openOptionsPage();
  });
});
