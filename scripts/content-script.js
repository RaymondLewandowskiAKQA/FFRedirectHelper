const LABEL_ID = "envLabel",
  BROWSER_STORAGE_AREA = "local",
  OUTLINED_ATTRIBUTE = "ff-redirect-component",
  BROWSER_STORAGE = browser.storage.local;

var currentSite; // we have to make this a global variable since it won't be able to be retrieved after
// a settings update

// globally defined functions are not available so must be redefined here
function hexToRgb(hex) {
  // from: https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb/5624139#5624139
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getTextColor(r, g, b) {
  // https://stackoverflow.com/questions/11867545/change-text-color-based-on-brightness-of-the-covered-background-area/11868159#11868159
  // http://www.w3.org/TR/AERT#color-contrast
  // yes, these numbers are hardcoded, but it's also defined by the
  // W3C so should not need to change
  var brightness = Math.round(
    (parseInt(r) * 299 + parseInt(g) * 587 + parseInt(b) * 114) / 1000
  );
  return (textColor = brightness > 125 ? "black" : "white");
}

function htmlElement(tagName, content, attrs, listeners) {
  var node = document.createElement(tagName);
  if (content != null) {
    // if content is not null or undefined
    node.textContent = content;
  }
  for (let attr in attrs || {}) {
    node.setAttribute(attr, attrs[attr]);
  }
  for (let event in listeners || {}) {
    node.addListener(event, listeners[event]);
  }
  return node;
}

function showSiteLabel(site) {
  var name = site.name || "",
    bkg = site.color || "#ffffff",
    rgb = hexToRgb(bkg),
    fore = getTextColor(rgb.r, rgb.g, rgb.b);
  envLabelEle = htmlElement("div", null, {
    id: LABEL_ID,
    style: `--bkg:${bkg};--fore:${fore}`,
  });
  envLabelEle.appendChild(htmlElement("span", name));
  // anchor to top:
  document.body.insertBefore(envLabelEle, document.body.firstChild);
  // anchor to bottom:
  // document.body.appendChild(envLabelEle);
}

function clearLabels() {
  envLabelEle = document.getElementById(LABEL_ID);
  while (envLabelEle) {
    envLabelEle.remove();
    envLabelEle = document.getElementById(LABEL_ID);
  }
}

function updateLabel(site) {
  BROWSER_STORAGE.get().then((data) => {
    clearLabels();
    // if (site===null) {
    //   return;
    // }
    // check if we should be showing envLabels
    if (
      typeof data.showEnvLabels !== "undefined" &&
      data.showEnvLabels === true
    ) {
      // if we are on a site being tracked by data.sites
      // if (data.sites.some(function(dataSite){return dataSite.id===site.id})) {
      showSiteLabel(site);
      browser.runtime
        .sendMessage({
          type: "toggleCSS",
          data: {
            showCSS: true,
          },
        })
        .catch((error) => {
          console.error(error);
        });
      return;
      // }
    }
    browser.runtime
      .sendMessage({
        type: "toggleCSS",
        data: {
          showCSS: false,
        },
      })
      .catch((error) => {
        console.error(error);
      });
  });
}

function updateOutlines({ isEnabled }) {
  if (isEnabled) {
    // Add CSS class to outline elements
    document.querySelectorAll("*").forEach((ele) => {
      const componentClassPattern = /c[-_]?[0-9]/i;

      const aemIds = Array.from(ele.classList).filter((cls) =>
        componentClassPattern.test(cls)
      );
      const nextId = ele.getAttribute("data-compid");

      if (!nextId && !aemIds.length) {
        return;
      }
      const componentName = nextId ?? aemIds.join(" ");
      ele.setAttribute(OUTLINED_ATTRIBUTE, componentName);
    });
  } else {
    document.querySelectorAll(`[${OUTLINED_ATTRIBUTE}]`).forEach((ele) => {
      ele.removeAttribute(OUTLINED_ATTRIBUTE);
    });
  }
}

function tabUpdateMessageListener(request, sender, sendResponse) {
  if (request && request.type) {
    switch (request.type) {
      case "tabUpdate":
        console.log("Bar update from tabUpdate message");
        currentSite = request.data.site;
        updateLabel(request.data.site);
        break;
      case "outlineComponents":
        updateOutlines(request.data);
    }
  }
}

function settingsChangedListener(changes, area) {
  if (
    area == BROWSER_STORAGE_AREA &&
    ("showEnvLabels" in changes || "sites" in changes)
  ) {
    console.log("Bar update from settings change");
    // TODO: fetch the new site since currentSite is now outdated
    updateLabel(currentSite);
  }
}

if (!browser.runtime.onMessage.hasListener(tabUpdateMessageListener)) {
  browser.runtime.onMessage.addListener(tabUpdateMessageListener);
}

if (!browser.storage.onChanged.hasListener(settingsChangedListener)) {
  browser.storage.onChanged.addListener(settingsChangedListener);
}
