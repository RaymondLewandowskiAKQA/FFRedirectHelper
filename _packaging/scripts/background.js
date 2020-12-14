// CONTEXT MENUS ITEMS
async function updateContextMenuItems() {
  let sites = [],
      contextMap = {};
  // it would be cleaner to do this on a per menu-item basis 
  // (ie update if exists, remove if not), but just removing and
  // re-creating everything is easier
  await browser.contextMenus.removeAll(); 
  BROWSER_STORAGE.get()
  .then((data) => {
    if (typeof data.sites === "undefined" || !Array.isArray(data.sites)) {
      console.error("No sites found");
      return;
    }
    function getContextId(site,suffix) {
      var base = `${site.name.replace(/[^a-z0-9]/gi,"")}-${site.id}`;
      return suffix ? `${base}-${suffix}` : base;
    }
    function getContextName(site) {
      return `Open in ${site.name}`;
    }
    function addToContextMap(id,dest,isPreview) {
      contextMap[id] = {
        "dest":dest,
        "isPreview":isPreview
      }
    }
    browser.contextMenus.refresh();
    data.sites.forEach(function(site) {
      sites.push({
        [AUTHOR]:new AEMUrl(site.author),
        [PUBLISHED]:new AEMUrl(site.published),
      })
      if (site.enabled) {
        if (site.contextMenu.length>1) {
          // create the context menu parent
          browser.contextMenus.create({
            id: getContextId(site),
            title: getContextName(site),
            contexts: ["link"]
          });
          if (site.contextMenu.includes(AUTHOR)) {
            browser.contextMenus.create({
              id: getContextId(site,AUTHOR),
              title: "Author",
              parentId: getContextId(site),
              contexts: ["link"]
            });
            addToContextMap(getContextId(site,AUTHOR),site.author,false); 
          }
          if (site.contextMenu.includes(PREVIEW)) {
            browser.contextMenus.create({
              id: getContextId(site,PREVIEW),
              title: "Preview",
              parentId: getContextId(site),
              contexts: ["link"]
            });
            addToContextMap(getContextId(site,PREVIEW),site.author,true); 
          }
          if (site.contextMenu.includes(PUBLISHED)) {
            browser.contextMenus.create({
              id: getContextId(site,PUBLISHED),
              title: "Published",
              parentId: getContextId(site),
              contexts: ["link"]
            });
            addToContextMap(getContextId(site,PUBLISHED),site.published,false); 
          }
        } else if (site.contextMenu.length>0) {
          browser.contextMenus.create({
            id: getContextId(site),
            title: getContextName(site),
            contexts: ["link"]
          });
          addToContextMap(getContextId(site),
            site.contextMenu.includes(PUBLISHED) ? site.published : site.author,
            site.contextMenu.includes(PREVIEW)); 
        }
      }
    });
    return new Promise((resolve,reject)=>{
      data = {
        "sites":sites,
        "contextMap":contextMap
      }
      resolve(data);
    });
  })
  .catch((err)=>{
    console.error(err);
    console.error("An error has occured while retrieving settings.");
  });
  return new Promise((resolve,reject)=>{
    data = {
      "sites":sites,
      "contextMap":contextMap
    }
    resolve(data);
  });
}

(async ()=>{
  // this is messy
  var data = await updateContextMenuItems();
  // add event listener for the context menu to handle click events
  browser.contextMenus.onClicked.addListener((info,tab) => {
    if (data.contextMap.hasOwnProperty(info.menuItemId)) {
      let parsedUrl = new AEMUrl(info.linkUrl),
          currentEnv = "",
          parsedDest;

      // get the context menu item that was clicked
      // -------
      // unfortunately, a drawback of this design is that every registered URL
      // must be parsed in order to open the link. In the future I might 
      // look into a refactor to change this

      // find the matching url
      for (const site of data.sites) {
        if (parsedUrl.isSubpageOf(site.author)) {
          currentEnv = site.author;
          break;
        } else if (parsedUrl.isSubpageOf(site.published)) {
          currentEnv = site.published;
          break;
        }
      }
      parsedDest = parsedUrl.changeEnvironment(currentEnv,data.contextMap[info.menuItemId].dest);
      if (data.contextMap[info.menuItemId].isPreview) {
        parsedDest.setPreview();
      }
      browser.tabs.create({
        "active":true,
        "url":parsedDest.href
      });
    }
  });
})();

// RUNTIME MESSAGE HANDLER
// (at the moment, this is only being used to signal a settings change)
browser.runtime.onMessage.addListener((request,sender,sendResponse)=>{
  updateContextMenuItems()
  .then(()=>{
    sendResponse({success:true});
  });
});

// SEARCH BAR ICON HANDLER
browser.tabs.onUpdated.addListener((tabId,changeInfo,tab) => {
  var tabUrl;
  if (changeInfo.status==="complete") {
    BROWSER_STORAGE.get()
    .then((data)=>{
      if (typeof data.sites !== "undefined" && Array.isArray(data.sites)) {
        tabUrl = new AEMUrl(tab.url);
        for (var i=0;i<data.sites.length;i++) {
          if (tabUrl.isSubpageOf(data.sites[i].author) || 
              tabUrl.isSubpageOf(data.sites[i].published)) {
            browser.pageAction.show(tabId);
            return;
          }
        }
      }
      browser.pageAction.hide(tabId);
    })
    .catch((error) => {
      browser.pageAction.hide(tabId);
      console.error(`Error ${error}`);
    });
  }
});


// Redirect Handler
browser.webRequest.onBeforeRequest.addListener(
  async (requestDetails) => {
    // HAHAHAHAHAHAHAHAHA <insert more maniacal laughter here>
    // 
    // clarification from future me: laughter is at running all of this
    // in a blocking handler that runs on every time the url changes
    var data = await BROWSER_STORAGE.get();
    if (data.lockEnv) {
      var parsedUrl = new AEMUrl(requestDetails.url),
          parsedLockEnv = new AEMUrl(data.lockEnv),
          currentEnv = "",
          parsedDest;
      if (parsedUrl.isSubpageOf(data.lockEnv) && parsedLockEnv && parsedLockEnv.isPreview()===parsedUrl.isPreview()) {
        // if we are already in the destination environment, don't redirect
        // '{}' => take no action and continue request as normal
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
      return {};
    }
  },
  {urls: ["<all_urls>"],types:["main_frame"]},
  ["blocking"]
);

// probably a cleaner way to do this, but this initializes
// variables that should be reset every time the browser restarts
BROWSER_STORAGE.set({
  lockEnv:null
})
