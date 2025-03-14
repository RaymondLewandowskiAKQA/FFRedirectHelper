const SITE_LABEL_ID = "envLabel",
  // Component outlines
  COMPONENT_LABEL_CLASS = "component-label",
  COMPONENT_LABEL_COLOR = "#f00",
  COMPONENT_TARGET_CLASS = "ff-extension-target",
  GENERATED_TAG_NAME = "ff-extension-label",
  // Storage
  BROWSER_STORAGE_AREA = "local",
  BROWSER_STORAGE = browser.storage.local;

var currentSite; // we have to make this a global variable since it won't be able to be retrieved after
// a settings update

/* ---- Utils ----- */

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

function getElementPosition(target) {
  const isInDOM = document.body.contains(target);

  const emptyReturnValue = {
    top: undefined,
    bottom: undefined,
    left: undefined,
    right: undefined,
    x: undefined,
    y: undefined,
    width: undefined,
    height: undefined,
  };

  if (target == null) {
    return emptyReturnValue;
  }

  // If the target hasn't been added to the DOM yet, temporarily add it to retrieve the dimensions
  if (!isInDOM) {
    document.body.appendChild(target);
  }

  const { top, bottom, left, right, x, y, width, height } =
    target.getBoundingClientRect();

  const horizontalOffset = window.scrollX;
  const verticalOffset = window.scrollY;

  if (!isInDOM) {
    document.body.removeChild(target);

    // If the target is not in the DOM, it does not have a meaningful position yet,
    // but we still might want to know the width and height
    return Object.assign(emptyReturnValue, {
      width,
      height,
    });
  }

  return {
    top: top + verticalOffset,
    bottom: bottom + verticalOffset,
    left: left + horizontalOffset,
    right: right + horizontalOffset,
    x: x + horizontalOffset,
    y: y + verticalOffset,
    width,
    height,
  };
}

function getParents(target, filter = () => true) {
  const parents = [];
  do {
    if (filter(target)) {
      parents.unshift(target);
    }
    target = target.parentNode;
  } while (target);

  return parents;
}

function reduceParents(target, reducer, initialValue) {
  return getParents(target).reduce(reducer, initialValue);
}

function getComputedProperty(
  target,
  property,
  isValid = (value) => value !== ""
) {
  const propertyValue = window
    .getComputedStyle(target)
    .getPropertyValue(property);

  if (!isValid(propertyValue)) {
    if (!target.parentElement) return null;

    return getComputedProperty(target.parentElement, property, isValid);
  }

  return propertyValue;
}

/* ---- Actions ----- */

function showSiteLabel(site) {
  var name = site.name || "",
    bkg = site.color || "#ffffff",
    rgb = hexToRgb(bkg),
    fore = getTextColor(rgb.r, rgb.g, rgb.b);
  envLabelEle = htmlElement("div", null, {
    id: SITE_LABEL_ID,
    style: `--bkg:${bkg};--fore:${fore}`,
  });
  envLabelEle.appendChild(htmlElement("span", name));
  // anchor to top:
  document.body.insertBefore(envLabelEle, document.body.firstChild);
  // anchor to bottom:
  // document.body.appendChild(envLabelEle);
}

function clearSiteLabels() {
  envLabelEle = document.getElementById(SITE_LABEL_ID);
  while (envLabelEle) {
    envLabelEle.remove();
    envLabelEle = document.getElementById(SITE_LABEL_ID);
  }
}

function updateSiteLabel(site) {
  BROWSER_STORAGE.get().then((data) => {
    clearSiteLabels();
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

function getComponentLabelOffset(label, parent, isAnchoredToTop = true) {
  // Allow some overlap to account for extra space from padding and borders
  const allowedVerticalOverlap = 1;
  const allowedHorizontalOverlap = 5;

  const {
    top: parentTop,
    left: parentLeft,
    width: parentWidth,
    height: parentHeight,
  } = getElementPosition(parent);

  const { width: labelWidth, height: labelHeight } = getElementPosition(label);

  const parentLabelOffset = reduceParents(
    parent,
    (bottom, ele) => {
      const eleLabel = ele.querySelector(`:scope > .${COMPONENT_LABEL_CLASS}`);

      const { bottom: labelBottom, right: labelRight } =
        getElementPosition(eleLabel);

      const hasLabel = !!labelBottom;
      const isLabelOverElement =
        labelRight > parentLeft + allowedHorizontalOverlap;

      if (!hasLabel || !isLabelOverElement) {
        return bottom;
      }

      return labelBottom;
    },
    0
  );

  const labelOffset = Math.max(
    parentLabelOffset - parentTop - allowedVerticalOverlap,
    0
  );

  if (
    parentWidth < labelWidth ||
    parentHeight < labelHeight ||
    isAnchoredToTop === false
  ) {
    return Math.max(parentHeight, labelOffset);
  }

  return labelOffset;
}

function buildBorder(parent, color) {
  // Build element
  const borderEle = document.createElement(GENERATED_TAG_NAME);

  Object.assign(borderEle.style, {
    position: "absolute",
    visibility: "hidden",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,

    borderWidth: "3px",
    borderStyle: "dashed",
    borderColor: color,
    pointerEvents: "none",
  });

  return borderEle;
}

function buildComponentLabel(parent, labelText, color, isAnchoredToTop = true) {
  // Build element
  const labelEle = document.createElement(GENERATED_TAG_NAME);
  labelEle.classList.add(COMPONENT_LABEL_CLASS);
  labelEle.innerText = labelText;

  // Calculate dynamic styles
  const computedZIndex =
    parseInt(
      getComputedProperty(parent, "z-index", (value) => !isNaN(value))
    ) || 0;
  const depth = getParents(parent).length;
  const zIndex = depth + computedZIndex + 2000;

  Object.assign(labelEle.style, {
    position: "absolute",
    visibility: "hidden",
    top: 0,
    left: 0,
    zIndex: zIndex ?? 2,

    padding: "2px",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: color,
    backgroundColor: "white",

    color: color,
    fontSize: "1rem",
    fontFamily: "sans-serif",
    fontWeight: "normal",
    whiteSpace: "nowrap",

    pointerEvents: "none",
  });

  // Stack labels below each other to prevent overlapping
  const labelOffset = getComponentLabelOffset(
    labelEle,
    parent,
    isAnchoredToTop
  );
  labelEle.style.top = `${labelOffset}px`;

  return labelEle;
}

function updateOutlines({ isEnabled }) {
  if (isEnabled) {
    // Add CSS class to outline elements
    document.querySelectorAll("*").forEach((target) => {
      const componentClassPattern = /^c[-_]?[0-9]/i;

      const aemIds = Array.from(target.classList).filter((cls) =>
        componentClassPattern.test(cls)
      );
      const analyticsId = componentClassPattern.test(
        target.getAttribute("data-id")
      )
        ? target.getAttribute("data-id")
        : undefined;
      const nextId = target.getAttribute("data-compid");

      if (!analyticsId && !nextId && !aemIds.length) {
        return;
      }
      const componentName = analyticsId ?? nextId ?? aemIds.join(" ");

      const borderEle = buildBorder(target, COMPONENT_LABEL_COLOR);
      target.appendChild(borderEle);

      const labelEle = buildComponentLabel(
        target,
        componentName,
        COMPONENT_LABEL_COLOR
      );
      target.appendChild(labelEle);

      target.classList.add(COMPONENT_TARGET_CLASS);

      target.addEventListener("mouseenter", () => {
        Object.assign(borderEle.style, {
          visibility: "visible",
        });
        Object.assign(labelEle.style, {
          visibility: "visible",
        });
      });

      target.addEventListener("mouseleave", () => {
        Object.assign(borderEle.style, {
          visibility: "hidden",
        });
        Object.assign(labelEle.style, {
          visibility: "hidden",
        });
      });
    });
  } else {
    document.querySelectorAll(GENERATED_TAG_NAME).forEach((ele) => {
      ele.remove();
    });
    document.querySelectorAll(`.${COMPONENT_TARGET_CLASS}`).forEach((ele) => {
      ele.classList.remove(COMPONENT_TARGET_CLASS);
    });
  }
}

/* ---- Main ----- */

function tabUpdateMessageListener(request, sender, sendResponse) {
  if (request && request.type) {
    switch (request.type) {
      case "tabUpdate":
        console.log("Bar update from tabUpdate message");
        currentSite = request.data.site;
        updateSiteLabel(request.data.site);
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
    updateSiteLabel(currentSite);
  }
}

if (!browser.runtime.onMessage.hasListener(tabUpdateMessageListener)) {
  browser.runtime.onMessage.addListener(tabUpdateMessageListener);
}

if (!browser.storage.onChanged.hasListener(settingsChangedListener)) {
  browser.storage.onChanged.addListener(settingsChangedListener);
}
