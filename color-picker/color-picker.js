var PICKER_CLASS = "picker",
    HUE_CLASS = "picker-hue",
    DOT_CLASS = "picker-dot",
    GRADIENT_CLASS = "picker-gradient",
    HUE_PROPERTY = "--hue";

const DEFAULT_HUE=0,
      DEFAULT_SAT=0.5,
      DEFAULT_VAL=0.5;

var PICKER_HTML = `
<div class="${PICKER_CLASS}">
  <div class="${HUE_CLASS}">
    <input type="range" class="hidden" orient="vertical">
    <div class="${DOT_CLASS}"></div>
  </div>
  <div class="${GRADIENT_CLASS}">
    <div class="${DOT_CLASS}"></div>
  </div>
</div>
`;

var root = document.documentElement;
// var 

/* utility functions */

function HSVtoRGB(h, s, v) {
    // from: https://stackoverflow.com/questions/17242144/javascript-convert-hsb-hsv-color-to-rgb-accurately
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: clampValue(Math.round(r * 255),0,255),
        g: clampValue(Math.round(g * 255),0,255),
        b: clampValue(Math.round(b * 255),0,255)
    };
}

function RGBtoHex(r,g,b) {
    if (typeof r ==="undefined" || typeof g === "undefined" || typeof b === "undefined") {
        return "";
    }
    var hex = [r,g,b].map(function(x){  
      x = parseInt(x).toString(16);     
      return (x.length==1) ? "0"+x : x; 
    })
    return "#"+hex.join("");
}

function clampValue(val,min,max) {
    return Math.min(max,Math.max(min,val));
}

function htmlToElement(html) {
    var tmpContainer = document.createElement("div");
    tmpContainer.innerHTML = html.trim();
    return tmpContainer.firstChild;
}

function moveDotToMouse(parent, mouseX, mouseY, optionsObj) {
    // this function was pretty at one point, I promise
    var boundingRect = parent.getBoundingClientRect(),
        defaultXPct = optionsObj && (typeof optionsObj.defaultX!=="undefined") ? optionsObj.defaultX : 0.5,
        defaultYPct = optionsObj && (typeof optionsObj.defaultY!=="undefined") ? optionsObj.defaultY : 0.5,
        dots,dotRect,leftPct,topPct;
    dots = parent.getElementsByClassName(DOT_CLASS);
    if (dots.length <= 0) {
        return false;
    }
    if (typeof mouseX === "undefined") {
        mouseX = boundingRect.x+boundingRect.width*defaultXPct;
    }
    if (typeof mouseY === "undefined") {
        mouseY = boundingRect.y+boundingRect.height*defaultYPct;
    }
    mouseX = clampValue(mouseX,boundingRect.x,boundingRect.x+boundingRect.width);
    mouseY = clampValue(mouseY,boundingRect.y,boundingRect.y+boundingRect.height);
    Array.from(dots).forEach((dot)=>{
        dotRect = dot.getBoundingClientRect();
        leftPct = ((mouseX-boundingRect.x)-(dot.clientWidth/2))/boundingRect.width*100;
        // the dot will always be clamped to the picker bounds unless explicitly specified otherwise 
        if (optionsObj && typeof optionsObj.clampDot!=="undefined" && optionsObj.clampDot==false) {
            dot.style.left = leftPct+"%";
        } else {
            // clamp dot to picker bounds, taking into account the dot's size (otherwise it will be 
            // outside the picker when left is 100%)
            dot.style.left = clampValue(leftPct,0,Math.max(100*(boundingRect.width-dotRect.width)/boundingRect.width,0))+"%";
        }
        // as above, but for the y axis
        topPct = ((mouseY-boundingRect.y)-(dot.clientHeight/2))/boundingRect.height*100;
        if (optionsObj && typeof optionsObj.clampDot!=="undefined" && optionsObj.clampDot==false) {
            dot.style.top = topPct+"%";           
        } else {
            dot.style.top = clampValue(topPct,0,100*(boundingRect.height-dotRect.height)/boundingRect.height)+"%";           
        }
    })
}


function updateColor(parent,mouseX,mouseY) {
    let boundingRect = parent.getBoundingClientRect(),
        dots,dotRect,rgb,
        h=DEFAULT_HUE,
        s=DEFAULT_SAT,
        v=DEFAULT_VAL;
    // checks? who needs checks?
    dots = parent.getElementsByClassName(DOT_CLASS);
    if (dots.length > 0) {
        dotRect = dots[0].getBoundingClientRect();
    } else {
        return false
    }
    h = (parseInt(parent.style.getPropertyValue(HUE_PROPERTY),10)||0)/360;
    if (mouseX && mouseY) {
        //only the saturation and value are defined by the gradient
        s = ((mouseX-boundingRect.x)-(dotRect.width/2))/boundingRect.width;
        v = 1-(((mouseY-boundingRect.y)-(dotRect.height/2))/boundingRect.height)
        rgb = HSVtoRGB(h,s,v)
    } else if (parent.color) {
        //only the saturation and value are defined by the gradient
        s = parent.color.s;
        v = parent.color.v;
        rgb = HSVtoRGB(h,parent.color.s,parent.color.v);
    } else {
        rgb = HSVtoRGB(h,s,v);
    }
    parent.color = {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        h: h,
        s: clampValue(s,0,1),
        v: clampValue(v,0,1),
        hex: RGBtoHex(rgb.r,rgb.g,rgb.b)
    };
    parent.setAttribute("data-color",`rgb(${parent.color.r},${parent.color.g},${parent.color.b})`);
    return true;
}

function addEventListeners(element,listenerMap,...args) {
    for (var eventType in listenerMap) {
        element.addEventListener(eventType,listenerMap[eventType].bind(element,...args))
    }
}

/* EVENT LISTENERS*/
function onMouseDown(evt) {
    if (evt.buttons&1 !== 0) {
        evt.preventDefault();
        this.setPointerCapture(evt.pointerId);
        this.onInteract.call(this,evt);
    }
}

function onMouseUp(evt) {
    if (evt.buttons&1 !== 0) {
        this.onInteract.call(this,evt);
        this.releasePointerCapture(evt.pointerId);
    }
}

function onMouseEnter(evt) {
    if (evt.buttons&1 !== 0){
        evt.preventDefault();
        this.onInteract.call(this,evt);
    } 
}

function onMouseLeave(evt) {
    if (this.hasPointerCapture(evt.pointerId)) {
        this.onInteract.call(this,evt)
    }
}

function onMouseMove(evt) {
    if (this.hasPointerCapture(evt.pointerId)) {
        this.onInteract.call(this,evt);
    }
}


/* SUB-EVENT LISTENERS */
function onGradientInteract(evt) {
    this.releasePointerCapture(evt.pointerId);
    moveDotToMouse(this,evt.pageX,evt.pageY,{clampDot:false});
    updateColor(this.picker,evt.pageX,evt.pageY);
    this.setPointerCapture(evt.pointerId);
}

function onHueInteract(evt) {
    var boundingRect = this.getBoundingClientRect(),
        sliderPos = clampValue((evt.pageY-boundingRect.y)/boundingRect.height,0,1);
    this.picker.querySelector("input[type='range']").value = 100*sliderPos; 
    this.picker.style.setProperty(HUE_PROPERTY,sliderPos*360||0);
    moveDotToMouse(this,undefined,evt.pageY);
    updateColor(this.picker);
}

/* picker functions */

function bindColorPicker(element) {
    if (!element.bound) {
        element.resetColor = function(h,s,v) {
            var sliderPos;
            h = typeof h !== "undefined" ? h : DEFAULT_HUE;
            s = typeof s !== "undefined" ? s : DEFAULT_SAT;
            v = typeof v !== "undefined" ? v : DEFAULT_VAL;
            if (element.color) {
                element.color.h = h;
                element.color.s = s;
                element.color.v = v;
            }
            element.style.setProperty(HUE_PROPERTY,h);
            element.querySelector("input[type='range']").value = 100*(h/360);
            updateColor(element);
            Array.from(element.getElementsByClassName(HUE_CLASS)).forEach((hueSlider)=>{
                moveDotToMouse(hueSlider,undefined,undefined,{
                    defaultY:h/360
                });
            });
            Array.from(element.getElementsByClassName(GRADIENT_CLASS)).forEach((colorGradient)=>{
                moveDotToMouse(colorGradient,undefined,undefined,{
                    defaultX:s,
                    defaultY:1-v,
                    clampDot:false
                });
            });
        }
        Array.from(element.getElementsByClassName(HUE_CLASS)).forEach((hueSlider)=>{
            hueSlider.onInteract = onHueInteract;
            hueSlider.picker = element;
            addEventListeners(hueSlider,{
                "pointerdown":onMouseDown,
                "pointerup":onMouseUp,
                "pointerenter":onMouseEnter,
                "pointerleave":onMouseLeave,
                "pointermove":onMouseMove
            })
        });
        Array.from(element.getElementsByClassName(GRADIENT_CLASS)).forEach((colorGradient)=>{
            colorGradient.onInteract = onGradientInteract;
            colorGradient.picker = element;
            addEventListeners(colorGradient,{
                "pointerdown":onMouseDown,
                "pointerup":onMouseUp,
                "pointerenter":onMouseEnter,
                "pointerleave":onMouseLeave,
                "pointermove":onMouseMove,
                "drag":(evt)=>{
                    evt.preventDefault()
                }
            })
        });
    }
    element.bound = true;
}

function getBoundColorPicker() {
    var pickerElement = htmlToElement(PICKER_HTML);
    bindColorPicker(pickerElement);
    pickerElement.resetColor();
    return pickerElement;
}

function bindAllColorPickers() {
    Array.from(document.getElementsByClassName(PICKER_CLASS)).forEach((parent)=>{
        bindColorPicker(parent);
    });
}

window.addEventListener("DOMContentLoaded",bindAllColorPickers);