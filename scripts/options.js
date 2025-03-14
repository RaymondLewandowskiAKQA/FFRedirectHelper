import * as globals from "./globals.mjs";
import * as fields from "./form-fields.js";

// form elements
const FORM = document.getElementById("options"),
  CONTAINER = document.getElementById("fieldset-container"),
  FIELDSET_CLASS = "card",
  DRAG_CLASS = "drag",
  ID_NAME = "id",
  SET_COLOR_NAME = "set-color",
  REMOVE_NAME = "remove";

// sub-form elements (ie multiple uses per card)
const VALID = "valid",
  INVALID = "invalid",
  ADD_DOMAIN = "add-domain";

const CSS_COLOR_PROPERTY = "--color";

// widget specific constants
const WIDGET_SAVE_ID = "picker-save",
  WIDGET_CLEAR_ID = "picker-clear",
  WIDGET_CANCEL_ID = "picker-cancel",
  COLOR_FIELD_NAME = "color",
  CARD_SELECTOR = "fieldset.card",
  MAX_OPEN_WIDGETS = 1;

// generic helper functions (used in field definitions below)
var envCount = 0;

// this could be handled equally well with
// eleName:[varName,func]
// but using the below notation allows for much more
// flexibility later on
const FIELD_MAP = {
  id: new fields.NumberField("id"),
  color: new fields.TextField("color"),
  enabled: new fields.CheckboxField("enabled", null, true),
  name: new fields.TextField("name"),
  "author-url": new fields.TextField("author", fields.validateAemAuthorUrl),
  "published-url": new fields.TextField(
    "published",
    fields.validateAemPublishedUrl
  ),
  "context-menu": new fields.CheckboxField("contextMenu"),
  // "new-tab":new CheckboxField("newTab",null,true)
};

// INITIALIZE CONTAINER LISTENERS
// ###################################################################
CONTAINER.addEventListener("dragover", (evt) => {
  evt.preventDefault();
  // console.log(evt);
});

CONTAINER.addEventListener("drop", (evt) => {
  evt.preventDefault();
  var srcId = Number.parseInt(evt.dataTransfer.getData("text")),
    destId,
    dropFieldset = evt.target.closest(CARD_SELECTOR);
  if (dropFieldset === null) {
    console.log("[dropped over container]");
    return;
  }
  destId = Number.parseInt(getField("id", dropFieldset).value);
  globals.BROWSER_STORAGE.get().then((data) => {
    for (var site of data.sites) {
      if (site.id === srcId) {
        site.id = destId;
      } else if (site.id === destId) {
        site.id = srcId;
      }
    }
    globals.BROWSER_STORAGE.set(data);
  });
  window.location.reload();
});

// HELPER FUNCTIONS
// ###################################################################

function getField(name, fieldset, allowMultiple) {
  var found = fields.getElementsByName(name, fieldset);
  if (found.length > 1) {
    if (allowMultiple) {
      return found;
    }
    throw new Error("Multiple fields found when exactly 1 was expected.");
  }
  return found[0];
}

// html form serialization functions
// --------------------------------
function getBasicFieldset() {
  // get new fieldset
  var newFieldset = document.getElementById(globals.TEMPLATE).cloneNode(true);
  fields.getElementsByName(REMOVE_NAME, newFieldset).forEach((ele) => {
    ele.addEventListener("click", (evt) => {
      newFieldset.remove();
    });
  });
  newFieldset.removeAttribute(ID_NAME);
  newFieldset.disabled = false;
  return newFieldset;
}

function getBoundFieldset(fieldMap, site) {
  var newFieldset = getBasicFieldset(),
    dragEvents = ["click", "drag", "dragstart"],
    titleSection;
  fields.getElementsByName(ID_NAME, newFieldset).forEach((input) => {
    input.value = envCount.toString();
  });
  titleSection = newFieldset.querySelector(".title");
  fields
    .getElementsByName(SET_COLOR_NAME, titleSection)
    .forEach((colorButton) => {
      colorButton.addEventListener("click", (evt) => {
        colorButton.classList.add(globals.HIDDEN);
        colorButton.disabled = true;
        showColorWidget(titleSection, site ? site.id : undefined, () => {
          colorButton.disabled = false;
          colorButton.classList.remove(globals.HIDDEN);
        });
      });
    });
  newFieldset.querySelectorAll("input").forEach((input) => {
    // auto-save and update functionality
    // input.addEventListener("mousedown",(evt)=>{
    //   evt.stopPropagation();
    // })
    // dragEvents.forEach((evtType)=>{
    //   input.addEventListener(evtType,(evt)=>{
    //     evt.preventDefault();
    //     evt.stopPropagation();
    //     return false;
    //   });
    // });
    input.addEventListener("blur", (evt) => {
      saveOptions(false);
    });
    // validation
    if (
      input.name &&
      fieldMap.hasOwnProperty(input.name) &&
      fieldMap[input.name].validate
    ) {
      input.addEventListener("blur", (evt) => {
        let validationMsg = fieldMap[input.name].validate(input.value);
        fields.getElementsByName(input.name, newFieldset).forEach((input) => {
          input.setCustomValidity(validationMsg || "");
          input.reportValidity();
        });
        if (validationMsg) {
          console.error(validationMsg);
          return null;
        }
      });
    }
  });
  // newFieldset.addEventListener("dragstart",(evt)=>{
  //   console.log(evt);
  //   evt.dataTransfer.setData("text",site.id);
  //   evt.dataTransfer.dropEffect="move";
  // });
  // newFieldset.querySelectorAll('.'+DRAG_CLASS).forEach((ele)=>{
  // });
  envCount += 1;
  return newFieldset;
}

function serializeFormData(container, fieldMap) {
  var formValues = [], // an array of js objects, one array per fieldset
    fieldsetData,
    serialized;
  for (let fieldset of container.getElementsByClassName(FIELDSET_CLASS)) {
    fieldsetData = {};
    for (let field in fieldMap) {
      serialized = fieldMap[field].fromInput(
        fields.getElementsByName(field, fieldset)
      );
      fieldsetData[serialized.name] = serialized.value;
    }
    formValues.push(fieldsetData);
  }
  return formValues;
}

function deserializeFormData(container, fieldMap, sites) {
  var fieldset;
  for (let site of sites) {
    fieldset = getBoundFieldset(fieldMap, site);
    fieldset.style.setProperty(CSS_COLOR_PROPERTY, site.color || "");
    for (let field in fieldMap) {
      fieldMap[field].toInput(site, fields.getElementsByName(field, fieldset));
      container.appendChild(fieldset);
      if (site.id != null && site.id > envCount) {
        envCount = site.id + 1;
      }
    }
  }
}

// save functions
function saveOptions(feedback = true) {
  var formData = serializeFormData(FORM, FIELD_MAP),
    filtered;
  if (formData != null) {
    filtered = formData.filter((site) => {
      return site.name;
    });
    globals.BROWSER_STORAGE.set({
      sites: filtered,
    })
      .then(() => {
        return browser.runtime.sendMessage({
          type: "contextMenuItems",
          data: {
            updated: true,
          },
        });
      })
      .then(() => {
        if (feedback) {
          fields.showSaveFeedback();
        }
        fields.sendDebugFeedback(`Saved (${filtered.length} items). `);
      })
      .catch((err) => {
        console.error(err);
      });
  } else {
    // validation failed
    console.error("no data saved");
    fields.sendDebugFeedback("Error: No data saved");
  }
}

function initOptionsPage() {
  globals.BROWSER_STORAGE.get().then((data) => {
    if (data.sites && Array.isArray(data.sites)) {
      data.sites.sort((first, second) => (first.id || 0) - (second.id || 0));
      deserializeFormData(CONTAINER, FIELD_MAP, data.sites);
    }
    fields.sendDebugFeedback(
      `Loaded ${data.sites.length} items (index at ${envCount}).`
    );
    // titles=Array.from(document.getElementsByClassName("title")); // for debugging
  });
}

FORM.addEventListener("submit", (evt) => {
  evt.preventDefault();
  saveOptions();
});

// Other functions
document.getElementById(ADD_DOMAIN).addEventListener("click", (evt) => {
  CONTAINER.appendChild(getBoundFieldset(FIELD_MAP));
});

["DOMContentLoaded"].forEach((event) => {
  window.addEventListener(event, initOptionsPage);
});

// IMPORT/EXPORT (to move into form-fields)
// ###################################################################

const EXPORT_KEYS = ["envLabelCSS", "sites"];
document.getElementById("export").addEventListener("click", (evt) => {
  evt.preventDefault();
  globals.BROWSER_STORAGE.get()
    .then((data) => {
      // from https://stackoverflow.com/questions/38750705/filter-object-properties-by-key-in-es6
      var toExport = Object.keys(data) //todo: replace with field validation (same as import)
        .filter((key) => EXPORT_KEYS.includes(key))
        .reduce((obj, key) => {
          obj[key] = data[key];
          return obj;
        }, {});
      fields.download(
        JSON.stringify(toExport),
        "AEM-Developer-settings-export.json",
        "application/JSON"
      );
    })
    .catch((err) => console.error(err));
  return false;
});

document.getElementById("import").addEventListener("click", (evt) => {
  evt.preventDefault();
  var fileInput = document.createElement("input");
  Object.assign(fileInput, {
    type: "file",
    accept: "application/json",
    multiple: false,
  });
  document.body.appendChild(fileInput);
  fileInput.addEventListener("change", (inputEvent) => {
    console.log(fileInput.value, fileInput.files);
    console.assert(fileInput.files.length === 1);
    var file = fileInput.files[0];
    file
      .text()
      .then((text) => {
        var sanitisedSettings = fields.sanitiseJsonSettings(JSON.parse(text));
        globals.BROWSER_STORAGE.set(sanitisedSettings)
          .then(() => {
            alert(
              `Settings imported (${sanitisedSettings.sites.length || 0} sites)`
            );
            location.reload();
          })
          .catch((err) => {
            console.error(err);
          });
      })
      .catch((err) => {
        alert("An error has occurred, check console for more information.");
        console.error(err);
      });
  });
  alert("Only import settings from trusted sources.");
  fileInput.click();
  setTimeout(() => {
    document.body.removeChild(fileInput);
  }, 0);
});

// COLOR WIDGET
// ###################################################################

var activeColorContainers = [];

function closeColorWidget(colorContainer) {
  if (colorContainer.parent) {
    colorContainer.parent.removeChild(colorContainer);
    colorContainer.parent = undefined;
  }
}

function saveWidgetColor(parent, color) {
  if (parent) {
    var card = parent.closest(CARD_SELECTOR), // YIKES
      colorFields = fields.getElementsByName(COLOR_FIELD_NAME, card); // even more Y I K E S
    if (colorFields.length > 0) {
      colorFields.forEach((colorField) => {
        colorField.value = color;
      });
      parent.style.setProperty(CSS_COLOR_PROPERTY, color);
      saveOptions(false);
    }
  } else {
    console.error("Widget parent not found");
  }
}

function showColorWidget(parent, siteId, callback) {
  var picker = getBoundColorPicker(),
    formData = serializeFormData(FORM, FIELD_MAP),
    colorContainer,
    buttonContainer,
    rgb,
    hsv;

  colorContainer = globals.htmlElement("fieldset", null, {
    class: "color-widget-container",
  });
  buttonContainer = globals.htmlElement("div", null, {
    class: "floating-button-container",
  });
  buttonContainer.appendChild(
    globals.htmlElement(
      "button",
      "Save",
      { type: "button" },
      {
        click: (e) => {
          saveWidgetColor(parent, picker.color.hex); // ok these attributes /might/ have gotten out of hand
          callback();
          closeColorWidget(colorContainer);
        },
      }
    )
  );
  buttonContainer.appendChild(
    globals.htmlElement(
      "button",
      "Clear",
      { type: "button" },
      {
        click: (e) => {
          saveWidgetColor(parent, "");
          callback();
          closeColorWidget(colorContainer);
        },
      }
    )
  );
  buttonContainer.appendChild(
    globals.htmlElement(
      "button",
      "Cancel",
      { type: "button" },
      {
        click: (e) => {
          callback();
          closeColorWidget(colorContainer);
        },
      }
    )
  );
  colorContainer.appendChild(buttonContainer);
  colorContainer.parent = parent;
  colorContainer.callback = callback;
  globals.prependChild(colorContainer, picker);
  while (
    activeColorContainers.length >= MAX_OPEN_WIDGETS &&
    activeColorContainers.length > 0
  ) {
    let activeContainer = activeColorContainers.shift();
    if (activeContainer.parent) {
      activeContainer.callback();
      activeContainer.parent.removeChild(activeContainer);
    }
  }
  globals.prependChild(parent, colorContainer);

  // hahahahaha this is so bad
  // anyway this gets the form data for the site with the correct id, then retrieves
  // the value of the color field. It does not check any of these exist or are correct
  // before retrieving them.
  // it then converts the hex to HSV format and updates the color picker to
  // have the correct color value.
  if (typeof siteId !== "undefined") {
    rgb = globals.hexToRgb(
      formData.filter((site) => {
        return site.id === siteId;
      })[0].color
    );
    if (rgb == null) {
      rgb = { r: 0, g: 0, b: 0 };
    }
    hsv = globals.RGBToHSV(rgb.r, rgb.g, rgb.b);
    picker.resetColor(hsv.h, hsv.s, hsv.v);
  }

  activeColorContainers.push(colorContainer);
}
