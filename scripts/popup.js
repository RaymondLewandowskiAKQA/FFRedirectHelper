import * as globals from "./globals.mjs";

var CONTAINER_ID = "container",
  ACTIVE_CLASS = "active",
  ACTIONS_CLASS = "actions",
  // button map consts
  LOAD_EVENTS = ["create"],
  DROPDOWN_KEY = "_dropdown",
  // static button IDs
  ENV_LABEL_ID = "show-bar",
  TOGGLE_OUTLINE_ID = "outline",
  DISABLE_CACHE_ID = "disable-cache",
  SETTINGS_ID = "settings",
  CSS_OUTLINE_FILE = "/styles/outline-components.css";

/*==================================================================*/

// an object with the following properties is passed to each listener
/*
 * card <HTMLElement>: The container for the button
 *
 * currentSite <object>: A site object containing the information
 *                       about the site the tab is currently on
 *                       (see options.js/FIELD_MAP for more info on
 *                       site objects)
 *
 * targetSite <object>: A site object containing the information the
 *                      button is pointing to. A click handler
 *                      should either update the current tab or
 *                      open a new tab with a subpage of this site.
 *
 * selectedTabs <browser.tab[]>: The browser tabs selected by the
 *                               user.
 *
 * parentName <string>: For buttons in a dropdown, this will be
 *                      the name of the button that opened the
 *                      dropdown. This name is the same as the
 *                      property name defined in BUTTON_MAP. If the
 *                      button is not in a dropdown, parentName will
 *                      be that button's own name.
 */
var BUTTON_MAP = {
  [DROPDOWN_KEY]: {
    // the buttons inside the dropdown (the handlers will be the same
    // regardless of which button opened the dropdown)
    openInNewTab: {
      icon: "icons/svg/new-tab.svg",
      altText: "open in new tab",
      title: "Open in new tab",
      events: {
        click: function (
          event,
          { currentSite, targetSite, selectedTabs, parentName }
        ) {
          var updateProperties = {},
            destUrl;
          switch (parentName) {
            case "siteadmin":
              console.log("input", targetSite.author);
              destUrl = new globals.AEMUrl(targetSite.author).setSiteAdmin(
                true
              );
              break;
            case "author":
              destUrl = new globals.AEMUrl(targetSite.author).setPreview(false);
              break;
            case "preview":
              destUrl = new globals.AEMUrl(targetSite.author).setPreview(true);
              break;
            case "published":
              destUrl = new globals.AEMUrl(targetSite.published);
              break;
          }
          console.log(destUrl.href);
          if (selectedTabs.length > 1) {
            if (
              !window.confirm(
                "Are you sure you want to open " +
                  selectedTabs.length +
                  " new tabs?"
              )
            ) {
              return;
            }
            updateProperties.active = false;
          }
          selectedTabs.reverse().forEach((tab) => {
            var url = changeEnvironment(tab.url, currentSite, destUrl);
            if (parentName === "siteadmin") {
              url = url.split("/").slice(0, -1).join("/");
            }
            openUrl(url, tab, true, updateProperties);
          });
        },
      },
    },
  },
  siteadmin: {
    icon: "icons/svg/menu-list.svg",
    altText: "Menu icon",
    title: "Open in site admin (in new tab)",
    opensDropdown: true,
    events: {
      create: function (button, { targetSite, selectedTabs }) {
        if (!targetSite.author) {
          button.disabled = true;
        }
      },
      click: function (event, { currentSite, targetSite, selectedTabs }) {
        selectedTabs.forEach((tab) => {
          let url = changeEnvironment(
            tab.url, // remove the last path segment
            currentSite,
            new globals.AEMUrl(targetSite.author).setSiteAdmin()
          );
          url = url.split("/").slice(0, -1).join("/");
          openUrl(new globals.AEMUrl(url).href, tab);
        });
      },
    },
  },
  author: {
    icon: "icons/svg/pencil.svg",
    altText: "pencil icon",
    title: "Open author environment",
    opensDropdown: true,
    events: {
      create: function (button, { targetSite, selectedTabs }) {
        if (!targetSite.author) {
          button.disabled = true;
        }
      },
      click: function (event, { currentSite, targetSite, selectedTabs }) {
        selectedTabs.forEach((tab) => {
          console.log(new globals.AEMUrl(targetSite.author).setPreview(false));
          openUrl(
            changeEnvironment(
              tab.url,
              currentSite, // TODO: this needs to be unique per-tab (this currently fails for tabs with different environs)
              new globals.AEMUrl(targetSite.author).setPreview(false)
            ),
            tab
          );
        });
      },
    },
  },
  preview: {
    icon: "icons/svg/magnifier.svg",
    altText: "magnifier icon",
    title: "Open preview environment",
    opensDropdown: true,
    events: {
      create: function (button, { targetSite, selectedTabs }) {
        if (!targetSite.author) {
          button.disabled = true;
        }
      },
      click: function (event, { currentSite, targetSite, selectedTabs }) {
        selectedTabs.forEach((tab) => {
          openUrl(
            changeEnvironment(
              tab.url,
              currentSite,
              new globals.AEMUrl(targetSite.author).setPreview(true)
            ),
            tab
          );
        });
      },
    },
  },
  published: {
    icon: "icons/svg/globe.svg",
    altText: "globe icon",
    title: "Open published environment",
    opensDropdown: true,
    events: {
      create: function (button, { targetSite, selectedTabs }) {
        if (!targetSite.published) {
          button.disabled = true;
        }
      },
      click: function (event, { currentSite, targetSite, selectedTabs }) {
        selectedTabs.forEach((tab) => {
          openUrl(
            changeEnvironment(
              tab.url,
              currentSite,
              new globals.AEMUrl(targetSite.published)
            ),
            tab
          );
        });
      },
    },
  },
};

/*==================================================================*/
/*                        HELPER FUNCTIONS                          */
/*==================================================================*/

function getCurrentTab() {
  // tabs query is so that we can change the URL of the current tab
  return new Promise((resolve, reject) => {
    browser.tabs
      .query({
        active: true,
        currentWindow: true,
      })
      .then((tabs) => {
        console.assert(tabs.length == 1, "More than one active tab found");
        resolve(tabs[0]);
      })
      .catch((err) => {
        reject(err);
      });
  });
}

function getSelectedTabs() {
  return browser.tabs.query({
    highlighted: true,
    currentWindow: true,
  });
}

function openUrl(url, currentTab, openInNewTab = false, updateProperties = {}) {
  if (openInNewTab) {
    return browser.tabs.create(
      Object.assign(
        {
          active: true,
          openerTabId: currentTab.id,
          url: url,
          index: currentTab.index + 1,
        },
        updateProperties || {}
      )
    );
  } else {
    return browser.tabs.update(
      currentTab.id,
      Object.assign(
        {
          url: url,
        },
        updateProperties || {}
      )
    );
  }
}

function changeEnvironment(url, currentSite, targetSite) {
  var parsedUrl = new globals.AEMUrl(url);
  if (parsedUrl.isSubpageOf(currentSite.author)) {
    return parsedUrl.changeEnvironment(currentSite.author, targetSite).href;
  } else if (parsedUrl.isSubpageOf(currentSite.published)) {
    return parsedUrl.changeEnvironment(currentSite.published, targetSite).href;
  }
  console.error("Url not found in site: " + url, currentSite);
}

function setActiveState(element, activeState) {
  if (activeState) {
    element.classList.add(ACTIVE_CLASS);
  } else {
    element.classList.remove(ACTIVE_CLASS);
  }
}

function bindEvents(element, events, eventArgs) {
  Object.entries(events).forEach(([event, handler]) => {
    if (LOAD_EVENTS.includes(event)) {
      // yeah this is a lazy hack, but it does the job
      handler(element, eventArgs);
    } else {
      element.addEventListener(event, (evt) => handler(evt, eventArgs));
    }
  });
  return element;
}

/*==================================================================*/
/*                     CARD RENDER FUNCTIONS                        */
/*==================================================================*/

function toggleDropdown(button, { card, ...kwargs }) {
  if (button.classList.contains(ACTIVE_CLASS)) {
    card.removeChild(card.dropdown);
    card.dropdown = undefined;
    button.classList.remove(ACTIVE_CLASS);
  } else {
    if (card.dropdown) {
      card.removeChild(card.dropdown);
      card.dropdown.activeButton.classList.remove(ACTIVE_CLASS);
    }
    card.dropdown = renderDropdown({ card, ...kwargs });
    card.dropdown.activeButton = button;
    card.appendChild(card.dropdown);
    button.classList.add(ACTIVE_CLASS);
  }
}

function renderButton(cardData, eventArgs) {
  var buttonContainer = globals.htmlElement("span"),
    button,
    dropdownToggle;

  button = globals.htmlElement("button", null, {
    type: "button",
    class: "card-button",
    title: cardData.title || "Button",
  });
  button.appendChild(
    globals.htmlElement("img", null, {
      src: cardData.icon,
      alt: cardData.altText || "Button Image",
      "aria-hidden": true,
    })
  );
  buttonContainer.appendChild(bindEvents(button, cardData.events, eventArgs));

  if (cardData.opensDropdown) {
    dropdownToggle = globals.htmlElement("button", null, {
      type: "button",
      class: "card-button",
      name: "options",
      title: "More options",
    });
    dropdownToggle.addEventListener("click", (evt) => {
      toggleDropdown(dropdownToggle, eventArgs);
    });
    buttonContainer.appendChild(dropdownToggle);
  }
  return buttonContainer;
}

function renderDropdown(eventArgs) {
  var template, buttonContainer;

  template = globals.htmlElement("div", null, {
    class: "dropdown",
  });
  buttonContainer = globals.htmlElement("div", null, {
    class: "inline-group actions",
  });
  template.appendChild(buttonContainer);

  Object.entries(BUTTON_MAP[DROPDOWN_KEY]).forEach(([name, data]) => {
    buttonContainer.appendChild(renderButton(data, eventArgs));
  });
  return template;
}

function renderCard(targetSite, currentSite, selectedTabs) {
  /* this is arguably worse because it is hard-coded, but otoh at 
  least its completely contained in this function */
  var template, header, buttonContainer;

  template = globals.htmlElement("div", null, {
    class: "card",
  });
  header = globals.htmlElement("div", null, {
    class: "header",
    style: `--color:${targetSite.color || "black"};`,
  });
  template.appendChild(header);
  header.appendChild(
    globals.htmlElement("span", targetSite.name || "[Not found]", {
      class: "name",
    })
  );
  buttonContainer = globals.htmlElement("div", null, {
    class: "inline-group actions",
  });
  header.appendChild(buttonContainer);
  // buttonContainer = template.getElementsByClassName(ACTIONS_CLASS)[0];

  Object.entries(BUTTON_MAP).forEach(([name, data]) => {
    if (name !== DROPDOWN_KEY) {
      buttonContainer.appendChild(
        renderButton(data, {
          card: template,
          targetSite: targetSite,
          selectedTabs: selectedTabs,
          currentSite: currentSite,
          parentName: name,
        })
      );
    }
  });
  return template;
}

/*==================================================================*/
/*                     STATIC EVENT HANDLERS                        */
/*==================================================================*/

// disable cache button listener
function disableCache(evt, currentTarget, currentTab) {
  var disableCacheParam = "_dc",
    AEMClickParam = "cq_ck",
    nDigits = 12,
    url,
    parsedUrl;
  url = currentTab.url;
  if (!url) {
    console.warn("Unable to retrieve URL search parameters: invalid URL");
    return;
  }
  parsedUrl = new URL(url);
  // set the cachebusting param to a random [nDigit] digit integer
  parsedUrl.searchParams.set(
    disableCacheParam,
    Math.trunc(Math.random() * 10 ** nDigits).toString()
  );
  // remove the AEM cachebusting param, if any
  parsedUrl.searchParams.delete(AEMClickParam);
  browser.tabs.update({ url: parsedUrl.toString() });
}

// 'toggle outline' button listener
function toggleOutline(evt, currentTarget, currentTab) {
  var tabId;
  tabId = currentTab.id;
  if (!tabId) {
    // we don't raise an error since tabs such as
    // the developer window will not return
    // an Id and are still expected
    console.warn(`Tab ID not found`);
    return;
  }
  globals.BROWSER_STORAGE.get()
    .then((data) => {
      if (data.outlinedTabs.includes(tabId)) {
        // Remove CSS file for outline
        browser.tabs.removeCSS({
          file: CSS_OUTLINE_FILE,
        });

        // Send message to the content script to update the DOM
        browser.tabs.sendMessage(tabId, {
          type: "outlineComponents",
          data: {
            isEnabled: false,
          },
        });

        // Update internal state
        data.outlinedTabs.splice(data.outlinedTabs.indexOf(tabId), 1);
        currentTarget.classList.remove(ACTIVE_CLASS);
      } else {
        // Add CSS file for outline
        browser.tabs.insertCSS({
          file: CSS_OUTLINE_FILE,
        });

        // Send message to the content script to update the DOM
        browser.tabs.sendMessage(tabId, {
          type: "outlineComponents",
          data: {
            isEnabled: true,
          },
        });

        // Update internal state
        data.outlinedTabs.push(tabId);
        currentTarget.classList.add(ACTIVE_CLASS);
      }

      globals.BROWSER_STORAGE.set({
        outlinedTabs: data.outlinedTabs,
      });
    })
    .catch((error) => {
      console.error(error);
    });
}

// toggle env label button listener
function toggleEnvLabel(evt, currentTarget) {
  globals.BROWSER_STORAGE.get().then((data) => {
    setActiveState(currentTarget, !data.showEnvLabels);
    globals.BROWSER_STORAGE.set({
      showEnvLabels: !data.showEnvLabels || false,
    });
  });
}

/*==================================================================*/
/*                            MAIN                                  */
/*==================================================================*/

Promise.all([getCurrentTab(), getSelectedTabs()])
  .then(([currentTab, selectedTabs]) => {
    globals.BROWSER_STORAGE.get()
      .then((data) => {
        var tabAemUrl = new globals.AEMUrl(currentTab.url),
          currentSite;
        data.sites.sort((first, second) => (first.id || 0) - (second.id || 0));
        for (currentSite of data.sites) {
          if (
            tabAemUrl.isSubpageOf(currentSite.author) ||
            tabAemUrl.isSubpageOf(currentSite.published)
          ) {
            break;
          }
        }
        for (const targetSite of data.sites) {
          document
            .getElementById(CONTAINER_ID)
            .appendChild(renderCard(targetSite, currentSite, selectedTabs));
        }
        setActiveState(
          document.getElementById(ENV_LABEL_ID),
          data.showEnvLabels
        );
        setActiveState(
          document.getElementById(TOGGLE_OUTLINE_ID),
          data.outlinedTabs.includes(currentTab.id)
        );
      })
      .catch((err) => console.error(err));

    document.getElementById(ENV_LABEL_ID).addEventListener("click", (evt) => {
      toggleEnvLabel(evt, evt.currentTarget, currentTab);
    });
    document
      .getElementById(TOGGLE_OUTLINE_ID)
      .addEventListener("click", (evt) => {
        toggleOutline(evt, evt.currentTarget, currentTab);
      });
    document
      .getElementById(DISABLE_CACHE_ID)
      .addEventListener("click", (evt) => {
        disableCache(evt, evt.currentTarget, currentTab);
      });
    document.getElementById(SETTINGS_ID).addEventListener("click", (evt) => {
      browser.runtime.openOptionsPage();
    });
  })
  .catch((err) => console.error(err));
