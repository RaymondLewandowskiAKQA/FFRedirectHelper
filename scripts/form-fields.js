import * as globals from "./globals.mjs";

// rename to "options-general.js"
const SUCCESS_ID = "success",
  FEEDBACK_ID = "feedback",
  ERROR = "error",
  ITEM_DELIM = ",";

export function getElementsByName(name, parent) {
  return Array.from((parent || document).querySelectorAll(`[name="${name}"`));
}

export function assertInputType(ele, expected) {
  if (expected instanceof Array) {
    return (
      ele.type &&
      expected.some((expVal) => {
        return ele.type === expVal;
      })
    );
  } else if (!(ele.type && ele.type === expected)) {
    throw (
      `Invalid input type encountered ` +
      `(got ${ele.type}, expected '${expected}')`
    );
  }
}

// field handlers & related
// --------------------------------
export class Field {
  constructor(name, validateFunc) {
    this.name = name;
    this.validate = validateFunc;
  }
  fromInput(elementArray) {
    var values = [];
    elementArray.forEach((input) => {
      values.push(input.value);
    });
    return {
      name: this.name,
      value: values,
    };
  }
  toInput(data, elements) {
    if (data.hasOwnProperty(this.name)) {
      if (elements instanceof Array) {
        elements.forEach((input) => {
          input.value = data[this.name];
        });
      } else {
        elements.value = data[this.name];
      }
      return true;
    } else {
      return false;
    }
  }
}

export class TextField extends Field {
  fromInput(elements) {
    if (elements instanceof Array && elements.length == 1) {
      assertInputType(elements[0], ["text", "textarea"]);
      return {
        name: this.name,
        value: elements[0].value,
      };
    } else if (elements instanceof HTMLElement) {
      assertInputType(elements, ["text", "textarea"]);
      return {
        name: this.name,
        value: elements.value,
      };
    }
    throw `Only 1 value is allowed for ${name} (got ${elements.length})`;
  }
}

export class NumberField extends Field {
  fromInput(elementArray) {
    var parsedInt;
    if (elementArray instanceof Array && elementArray.length == 1) {
      assertInputType(elementArray[0], "text");
      parsedInt = parseInt(elementArray[0].value, 10);
      if (isNaN(parsedInt)) {
        throw `Invalid number: ${elementArray[0].value}, ${elementArray[0]}`;
      }
      return {
        name: this.name,
        value: parsedInt,
      };
    }
    throw `Only 1 value is allowed for ${name} (got ${elementArray.length})`;
  }
}

export class CheckboxField extends Field {
  constructor(name, validateFunc, combineValues) {
    super(name, validateFunc);
    this.combineValues = combineValues;
  }
  fromInput(elementArray) {
    var checkboxValues = [];
    elementArray.forEach((input) => {
      assertInputType(input, "checkbox");
      if (!input.disabled) {
        if (input.checked) {
          checkboxValues.push(input.value || "on");
        } else {
          checkboxValues.push(null);
        }
      }
    });
    return {
      name: this.name,
      value: this.combineValues
        ? checkboxValues.join(ITEM_DELIM)
        : checkboxValues,
    };
  }
  toInput(data, elementArray) {
    var values = [];
    if (data.hasOwnProperty(this.name)) {
      if (Array.isArray(data[this.name])) {
        values = data[this.name];
      } else if (this.combineValues && typeof data[this.name] === "string") {
        values = data[this.name].split(ITEM_DELIM);
      } else {
        throw "Data is in unrecognised format";
      }
    } else {
      throw `Property not found in storage: '${this.name}'`;
    }
    if (
      elementArray.every((input) => {
        return input.value && input.value !== "";
      })
    ) {
      // if every checkbox has a non-ambiguous destination
      // we are only doing a soft test for this
      elementArray.forEach((input) => {
        if (values.includes(input.value)) {
          input.checked = true;
        } else {
          input.checked = false;
        }
      });
    } else {
      if (values.length === elementArray.length) {
        for (let i = 0; i < elementArray.length; i++) {
          if (values[i] === "on") {
            elementArray[i].checked = true;
          } else {
            elementArray[i].checked = false;
          }
        }
      } else {
        throw "Checkbox values and unnamed inputs must be of same length";
      }
    }
    return true;
  }
}

// validation
export function validateAemAuthorUrl(val) {
  var parsed = new globals.AEMUrl(val);
  if (val.trim() && !parsed.isAuthor()) {
    return (
      "Value must be a valid AEM author URL " +
      "(including 'http(s)', a full domain name, and 'cf#')"
    );
  }
}

export function validateAemPublishedUrl(val) {
  var parsed = new globals.AEMUrl(val);
  if (val.trim() && !parsed.isPublished()) {
    return (
      "Value must be a valid AEM published URL " +
      "(including 'http(s)', a full domain name, WITHOUT 'wcmmode' or 'cf#')"
    );
  }
}

export function validateRegex(regularExpression, errorMessage) {
  var matchExp = RegExp(regularExpression);
  return function (val) {
    if (!matchExp.exec(val)) {
      return errorMessage;
    }
  };
}

export function validateValue(validationFunc, errorMessage) {
  return function (val) {
    if (!validationFunc(val)) {
      return errorMessage;
    }
  };
}

export function validateCheckBoxes(regularExpression, errorMessage) {
  var matchExp = RegExp(regularExpression);
  return function (vals) {
    if (Array.isArray(vals)) {
      for (let val of vals) {
        if (!(val === null || matchExp.exec(val))) {
          return errorMessage;
        }
      }
    }
    if (!(vals === null || matchExp.exec(vals))) {
      return errorMessage;
    }
  };
}

export function validateCSS(val) {
  // clean CSS here
}

export function sendDebugFeedback(msg) {
  document.getElementById(FEEDBACK_ID).textContent = msg;
}

export function showSaveFeedback() {
  let success = document.getElementById(SUCCESS_ID);
  success.classList.remove(globals.HIDDEN);
  setTimeout(() => {
    success.classList.add(globals.HIDDEN);
  }, 500);
}

// Import/Export funcs
// --------------------------------
const EXPORT_FIELD_VALIDATION = {
  envLabelCSS: validateCSS,
  sites: [
    {
      id: validateValue((val) => {
        return typeof val === "number" && val % 1 === 0 && val >= 0;
      }),
      color: validateRegex(
        /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/,
        "'Color' must be a hexadecimal color code"
      ),
      enabled: validateCheckBoxes(/^on$/i, "'Enabled' must be 'on' or null"),
      name: validateRegex(/^[a-zA-Z \-_0-9]+$/, "Invalid name"),
      author: validateAemAuthorUrl,
      published: validateAemPublishedUrl,
      contextMenu: validateCheckBoxes(
        /^author|preview|published$/,
        "Invalid checkbox value"
      ),
    },
  ],
};

export function sanitiseJsonSettings(
  jsonData,
  cleanObj,
  validationMap = EXPORT_FIELD_VALIDATION
) {
  // todo: clean this up later on
  var validationError;
  cleanObj = cleanObj || {};
  for (let key in jsonData) {
    if (validationMap.hasOwnProperty(key)) {
      if (validationMap[key].constructor === Function) {
        validationError = validationMap[key](jsonData[key]);
        if (validationError) {
          console.error(validationError);
          continue;
        }
        cleanObj[key] = jsonData[key];
      } else if (typeof validationMap[key] === "object") {
        if (Array.isArray(validationMap[key])) {
          console.assert(
            validationMap[key].length === 1,
            "Only one type is allowed in an array"
          );
          cleanObj[key] = [];
          if (validationMap[key][0].constructor === Function) {
            let validationFunction = validationMap[key][0];
            for (let val of jsonData[key]) {
              validationError = validationFunction(val);
              if (validationError) {
                console.error(validationError);
                continue;
              }
              cleanObj[key].push(val);
            }
          } else if (validationMap[key][0].constructor === Object) {
            let arrayObj;
            for (let val of jsonData[key]) {
              if (!val.constructor === Object) {
                continue;
              }
              arrayObj = {};
              sanitiseJsonSettings(val, arrayObj, validationMap[key][0]);
              if (Object.keys(arrayObj).length > 0) {
                cleanObj[key].push(arrayObj);
              }
            }
          }
        } else {
          cleanObj[key] = {};
          sanitiseJsonSettings(
            jsonData[key],
            cleanObj[key],
            validationMap[key]
          );
        }
        // sanitiseJsonSettings(jsonData[key],cleanObj);
      }
    }
  }
  return cleanObj;
}

export function download(data, filename, type) {
  // from: https://stackoverflow.com/questions/13405129/javascript-create-and-save-file
  var file = new Blob([data], { type: type });
  if (window.navigator.msSaveOrOpenBlob)
    // IE10+
    window.navigator.msSaveOrOpenBlob(file, filename);
  else {
    // Others
    var a = document.createElement("a"),
      url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }, 0);
  }
}
