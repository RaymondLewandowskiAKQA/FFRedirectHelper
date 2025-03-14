import * as globals from "./globals.mjs";
import * as fields from "./form-fields.js";

const FORM = document.getElementById("advanced-options");

// unlike the standard options, where the settings are 'name' based
// these settings are id based as they are individual settings
const FIELD_MAP = {
  "env-label-css": new fields.TextField("envLabelCSS"),
};

function serializeFormData(fieldMap) {
  var formValues = {}, // an array of js objects, one array per fieldset
    formEle,
    serialized;
  for (let field in fieldMap) {
    formEle = document.getElementById(field);
    if (formEle == null) {
      console.error(`Element with id:'${field}' not found.`);
      continue;
    }
    serialized = fieldMap[field].fromInput(formEle);
    formValues[serialized.name] = serialized.value;
  }
  return formValues;
}

function deserializeFormData(fieldMap, data) {
  var formEle;
  for (let field in fieldMap) {
    formEle = document.getElementById(field);
    if (formEle == null) {
      console.error(`Element with id:'${field}' not found.`);
      continue;
    }
    fieldMap[field].toInput(data, formEle);
  }
}

function saveFormData(showFeedback = true) {
  var formData = serializeFormData(FIELD_MAP);
  if (formData != null) {
    globals.BROWSER_STORAGE.set(formData)
      .then(() => {
        if (showFeedback) {
          fields.showSaveFeedback();
        }
        fields.sendDebugFeedback("Saved.");
      })
      .catch((error) => {
        fields.sendDebugFeedback(
          "Save unsuccessful (unexpected error, see console for details)."
        );
        console.error(error);
      });
  }
}

FORM.addEventListener("submit", (evt) => {
  evt.preventDefault();
  saveFormData();
});

window.addEventListener("DOMContentLoaded", () => {
  globals.BROWSER_STORAGE.get().then((data) => {
    deserializeFormData(FIELD_MAP, data);
    fields.sendDebugFeedback(`Settings loaded`);
  });
  document.querySelectorAll("textarea,input").forEach((formEle) => {
    formEle.addEventListener("blur", (evt) => {
      saveFormData(false);
    });
  });
});
