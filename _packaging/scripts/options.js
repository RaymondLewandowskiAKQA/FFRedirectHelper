// i/o related elements
const SUCCESS_ID = "success",
      FEEDBACK_ID = "feedback",
      ERROR = "error";

// form elements
const FORM = document.getElementById("options"),
      CONTAINER = document.getElementById("fieldset-container"),
      FIELDSET_CLASS = "card",
      ID_NAME = "id",
      REMOVE_NAME = "remove";
 
// sub-form elements (ie multiple uses per card)
const VALID = "valid",
      INVALID = "invalid",
      ADD_DOMAIN = "add-domain";

// generic helper functions (used in field definitions below)
var envCount = 0;

function getElementsByName(name,parent) {
  return Array.from((parent||document).querySelectorAll(`[name="${name}"`));
}


function assertInputType(ele,expected) {
  if (!(ele.type && ele.type===expected)) {
    throw `Invalid input type encountered `+
          `(got ${ele.type}, expected '${expected}')`
  }
}

function sendDebugFeedback(msg) {
   document.getElementById(FEEDBACK_ID).textContent = msg;
}

// field handlers & related
// --------------------------------
class Field {
  constructor(name,validateFunc,saveHandler) {
    this.name = name;
    this.validate = validateFunc;
    this.saveHandler = saveHandler || function (value) {return value};
  }
  fromInput(elementArray) {
    var values=[];
    elementArray.forEach((input)=>{
      values.push(input.value);
    });
    return {
      name:this.name,
      value:this.saveHandler(values)
    };
  }
  toInput(data,elementArray) {
    if (data.hasOwnProperty(this.name)) {
      elementArray.forEach((input)=>{
        input.value=data[this.name];
      });
      return true;
    } else {
      return false;
    }
  }
}

class TextField extends Field {
  fromInput(elementArray) {
    if (elementArray.length && elementArray.length==1) {
      assertInputType(elementArray[0],"text");
      return {
        name:this.name,
        value:this.saveHandler(elementArray[0].value)
      };
    }
    throw `Only 1 value is allowed for ${name} (got ${elementArray.length})`;
  }
}

class NumberField extends Field {
  fromInput(elementArray) {
    var parsedInt;
    if (elementArray.length && elementArray.length==1) {
      assertInputType(elementArray[0],"text");
      parsedInt = parseInt(elementArray[0].value,10);
      if (isNaN(parsedInt)) {
        throw `Invalid number: ${elementArray[0].value}, ${elementArray[0]}`;
      }
      return {
        name:this.name,
        value:this.saveHandler(parsedInt)
      };
    }
    throw `Only 1 value is allowed for ${name} (got ${elementArray.length})`;
  }
}

class CheckboxField extends Field {
  fromInput(elementArray) {
    var checkboxValues = [];
    elementArray.forEach((input)=>{
      assertInputType(input,"checkbox");
      if (!input.disabled) {
        if (input.checked) {
          checkboxValues.push(input.value||"on");
        } else {
          checkboxValues.push(null);
        }
      }
    })
    return {
      name:this.name,
      value:this.saveHandler(checkboxValues)
    };    
  }
  toInput(data,elementArray) {
    if (data.hasOwnProperty(this.name) && Array.isArray(data[this.name])) {
      if (elementArray.every((input)=>{return input.value && input.value!==""})) {
        elementArray.forEach((input)=>{
          if (data[this.name].includes(input.value)) {
            input.checked=true;
          } else {
            input.checked=false;
          }
        });
      } else {
        if (data[this.name].length===elementArray.length) {
          for (let i=0;i<elementArray.length;i++) {
            if (data[this.name][i]==="on") {
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
    } else {
      return false;
    }
  }
}

// validation
function validateAemAuthorUrl(val) {
  var parsed = new AEMUrl(val);
  if (val.trim() && !parsed.isAuthor()) {
    return "Value must be a valid AEM author URL "+
           "(including 'http(s)', a full domain name, and 'cf#')"
  } 
}
function validateAemPublishedUrl(val) {
  var parsed = new AEMUrl(val);
  if (val.trim() && !parsed.isPublished()) {
    return "Value must be a valid AEM published URL "+
           "(including 'http(s)', a full domain name, WITHOUT 'wcmmode' or 'cf#')"
  } 
}

// this could be handled equally well with 
// eleName:[varName,func]
// but using the below notation allows for much more
// flexibility later on
const FIELD_MAP = {
  "id":new NumberField("id"),
  "enabled":new CheckboxField("enabled",null,
                              (value)=>{return value[0]}),
  "name":new TextField("name"),
  "author-url":new TextField("author",validateAemAuthorUrl),
  "published-url":new TextField("published",validateAemPublishedUrl),
  "context-menu":new CheckboxField("contextMenu"),
  "new-tab":new CheckboxField("newTab",null,
                              (value)=>{return value[0]})
}


// html form serialization functions
// --------------------------------
function getBasicFieldset(parent) {
  // get new fieldset 
  var newFieldset = document.getElementById(TEMPLATE).cloneNode(true);
  getElementsByName(REMOVE_NAME,newFieldset).forEach((ele)=>{
    ele.addEventListener("click",(evt)=>{
      newFieldset.remove();
    });
  });
  newFieldset.removeAttribute(ID_NAME);
  newFieldset.disabled = false;
  return newFieldset;
}

function getBoundFieldset(parent,fieldMap) {
  var newFieldset = getBasicFieldset(parent);
  // TODO: move the below line into new function
  getElementsByName(ID_NAME,newFieldset).forEach((input)=>{
    input.value = envCount.toString();
  });
  newFieldset.querySelectorAll("input").forEach((input)=>{
    if (input.name && fieldMap.hasOwnProperty(input.name) 
        && fieldMap[input.name].validate) {
      input.addEventListener("blur",(evt)=>{
        let validationMsg = fieldMap[input.name].validate(input.value);
        getElementsByName(input.name,newFieldset).forEach((input)=>{
          input.setCustomValidity(validationMsg||"");
          input.reportValidity();
        });
        if (validationMsg) {
          console.error(validationMsg);
          return null;
        }
      });
    }
  })
  envCount += 1;
  return newFieldset;
}

function serializeFormData(container,fieldMap) {
  var formValues=[], // an array of js objects, one array per fieldset
      fieldsetData,serialized;
  for (let fieldset of container.getElementsByClassName(FIELDSET_CLASS)) {
    fieldsetData = {};
    for (let field in fieldMap) {
      serialized = fieldMap[field].fromInput(getElementsByName(field,fieldset));
      fieldsetData[serialized.name]=serialized.value;
    }
    formValues.push(fieldsetData);
  }
  return formValues;
}

function deserializeFormData(container,fieldMap,sites) {
  var fieldset;
  for (let site of sites) {
    fieldset = getBoundFieldset(container,fieldMap);
    for (let field in fieldMap) {
      fieldMap[field].toInput(site,getElementsByName(field,fieldset));
    container.appendChild(fieldset);
    if (site.id!=null && site.id>envCount) {
      envCount = site.id + 1;
    }
    }
  }
}

// save functions
function showSaveFeedback(isSuccess=true) {
  let success = document.getElementById(SUCCESS_ID);
  success.classList.remove(HIDDEN);
  setTimeout(()=>{
    success.classList.add(HIDDEN);
  },500);
}

function saveOptions() {
  var formData = serializeFormData(FORM,FIELD_MAP),
      filtered;
  if (formData!=null) {
    filtered = formData.filter((site)=>{return site.name});
    BROWSER_STORAGE.set({
      sites:filtered
    })
    .then(()=>{
      return browser.runtime.sendMessage({updated:true});
    })
    .then(()=>{
      showSaveFeedback(true)
      sendDebugFeedback(`Saved (${filtered.length} items). `);
    });
  } else {
    // validation failed
    console.error("no data saved");
   sendDebugFeedback("Error: No data saved");
  }
}

FORM.addEventListener("submit",(evt)=>{
  evt.preventDefault();
  saveOptions();
});

// Other functions
document.getElementById(ADD_DOMAIN).addEventListener("click",(evt)=>{
  CONTAINER.appendChild(getBoundFieldset(CONTAINER,FIELD_MAP));
});

document.addEventListener("DOMContentLoaded",()=>{
  BROWSER_STORAGE.get()
  .then((data) => {
    if (data.sites && Array.isArray(data.sites)) {
      deserializeFormData(CONTAINER,FIELD_MAP,data.sites);
    }
    sendDebugFeedback(`Loaded ${data.sites.length} items (index at ${envCount}).`);
  })
})
