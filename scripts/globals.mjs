// CONTANTS
export var AUTHOR_PATH = "/cf",
           SITEADMIN_PATH = "/siteadmin",
           TOUCH_PATH = "/editor.html",
           WCMMODE = "wcmmode",
           HTML_EXT = "html",
           
           AUTHOR = "author",
           PREVIEW = "preview",
           PUBLISHED = "published",
           
           HIDDEN = "hidden",
           TEMPLATE = "template",
           
           THEME_PATH = "icons/themes",
           
           HAS_EXTENSION_API = (typeof browser!=="undefined"),
           
           BROWSER_STORAGE = HAS_EXTENSION_API ? browser.storage.local : undefined;

// BASIC STRING/URL FUNCTIONS

export function maxSplit(str,delim,nTimes,rTrim) {
  var dir=rTrim ? -1:1,
      left,right;
  if (nTimes) {
    left = str.split(delim).slice(0,dir*nTimes);
    right = str.split(delim).slice(dir*nTimes);
    if (rTrim) {
      return [left.join(delim)].concat(right);
    } else {
      return left.concat(right.join(delim)); 
    }
  }
  return str.split(delim);
}

export function getPathWithDefault(obj,defaultValue,...properties) {
  var head = obj,
      success=true;
  for (var property of properties) {
    if (head.hasOwnProperty(property)) {
      head = head[property];
    } else {
      success = false;
      break;
    }
  }
  return success ? head : defaultValue; 
}

export function trimExt(url) {
  if (url instanceof URL) {
    return url.pathname.includes('.') ? url.pathname.split('.').slice(0,-1).join('.') : url.pathname;
  } else {
    return url.includes('.') ? url.split('.').slice(0,-1).join('.') : url;
  }
}

export function getExt(url) {
  var extSlice = url.split('.').slice(-1);
  if (!url.includes('.')) {
    return "";
  }
  return extSlice.length ? extSlice[0] : "";
}


export function getThemeIcon(theme,file) {
  theme = theme.trim('/');
  file = file.trim('/');
  return `${THEME_PATH}/${theme}/${file}`;
}

export function htmlElement(tagName,content,attrs,listeners) {
  var node = document.createElement(tagName);
  if (content!=null) { // if content is not null or undefined
    node.textContent = content;
  }
  for (let attr in attrs||{}) {
    node.setAttribute(attr,attrs[attr]);
  }
  for (let event in listeners||{}) {
    node.addEventListener(event,listeners[event]);
  }
  return node;
}


export function prependChild(parent,ele) {
  parent.insertBefore(ele,parent.firstChild);
}

// COLOR CONVERSIONS
export function hexToRgb(hex) {
  // from: https://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb/5624139#5624139
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function RGBToHSV(r,g,b) {
  // from https://css-tricks.com/converting-color-spaces-in-javascript/
  // and https://en.wikipedia.org/wiki/HSL_and_HSV#Interconversion
  r /= 255;
  g /= 255;
  b /= 255;
  let cmin = Math.min(r,g,b),
      cmax = Math.max(r,g,b),
      delta = cmax - cmin,
      h = 0,
      s = 0,
      l = 0,
      v;
  // Calculate hue
  // No difference
  if (delta == 0)
    h = 0;
  // Red is max
  else if (cmax == r)
    h = ((g - b) / delta) % 6;
  // Green is max
  else if (cmax == g)
    h = (b - r) / delta + 2;
  // Blue is max
  else
    h = (r - g) / delta + 4;
  h = Math.round(h * 60);
  // Make negative hues positive behind 360°
  if (h < 0)
      h += 360;
  // Calculate lightness
  l = (cmax + cmin) / 2;
  // Calculate saturation
  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  // s = +(s);
  // l = +(l);
  // convert hsl to hsv 
  v = l+s*Math.min(l,1-l);
  s = v===0?0:2*(1-(l/v));
  return {
    h:+(h).toFixed(3),
    s:+(s).toFixed(3),
    v:+(v).toFixed(3)
  }
}

export function HSVtoRGB(h, s, v) {
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

export function RGBtoHex(r,g,b) {
    if (typeof r ==="undefined" || typeof g === "undefined" || typeof b === "undefined") {
        return "";
    }
    var hex = [r,g,b].map(function(x){  
      x = parseInt(x).toString(16);     
      return (x.length==1) ? "0"+x : x; 
    })
    return "#"+hex.join("");
}

// AEM URL CLASS

export class AEMUrl {
  constructor(url) {
    var trimmedUrl;
    if (url instanceof AEMUrl) {
      return url;
    } else if (!(typeof url==="string" || url instanceof String)) {
      throw TypeError("'url' parameter must be of type string or AEMUrl");
    }

    this._query = {};
    // this section does literally nothing as it is all overridden below
    // WHHHYYYYYY
    this.protocol = url.protocol || "";
    this.domain = url.domain || "";
    this.path = url.path || "";
    this.query = url.query || "";
    this.fragment = url.fragment || "";
    this.ext = url.ext || "";

    trimmedUrl = url;
    if (trimmedUrl.includes("://")) {
      [this.protocol,trimmedUrl] = maxSplit(trimmedUrl,"://",1);
    }
    if (trimmedUrl.includes("?")) {
      [trimmedUrl,this.query] = maxSplit(trimmedUrl,"?",1);
      if (this.query.includes("#")) {
        [this.query,this.fragment] = maxSplit(this.query,"#",1);
      }
    }
    if (trimmedUrl.includes("#")) {
      [trimmedUrl,this.fragment] = maxSplit(trimmedUrl,"#",1);
    }
    if (trimmedUrl.includes("/")) {
      [this.domain,this.path] = maxSplit(trimmedUrl,"/",1);
      this.path = '/'+this.path; // add a slash back in after it was removed by split
      if (this.path.includes('.')) {
        [this.path,this.ext]=maxSplit(this.path,'.',1,true);
      }
    } else {
      this.domain = trimmedUrl;
    }
  }

  get query() {
    var output = "",
        first=true;
    for (const key of Object.keys(this._query)) {
      if (first) {
        output += [key,this._query[key]].join("=");
        first = false;
      } else {
        output += "&"+[key,this._query[key]].join("=");
      }
    }
    return output;
  }

  set query(value) {
    var params;
    if (!value) {
      return;
    }
    if (typeof value==="string" || value instanceof String) {
      let key,val;
      if (value.startsWith("?")) {
        value = value.slice(1);
      }
      params = value.split("&");
      for (const param of params) {
        [key,val] = maxSplit(param,'=',1);
        this._query[key] = val;
      }
    } else if (typeof value==="object") {
      for (const key of Object.keys(value)) {
        this._query[key] = value[key];
      }
    } else {
      throw TypeError("query must be set to either a query string or an object represeting one")
    }
    return this._query;
  }

  format(urlComponentsObj) {
    var unparsed = "";
    urlComponentsObj = urlComponentsObj || this;
    if (!urlComponentsObj instanceof AEMUrl) {
      throw TypeError("'urlComponentsObj' argument must be of type AEMUrl")
    }
    // there has got to be a better way to do this...
    if (urlComponentsObj.protocol) {
      unparsed += urlComponentsObj.protocol+"://";
    }
    if (urlComponentsObj.domain) {
      unparsed += urlComponentsObj.domain;
    }
    if (urlComponentsObj.path) {
      if (urlComponentsObj.path && !urlComponentsObj.path.startsWith("/")) {
        unparsed += "/";
      }
      unparsed+=urlComponentsObj.path;
    }
    if (urlComponentsObj.ext) { 
      unparsed+='.'+urlComponentsObj.ext;
    }
    if (urlComponentsObj.query) {
      if (!urlComponentsObj.query.startsWith("?")) {
        unparsed += "?";
      }
      unparsed+=urlComponentsObj.query;
    }
    if (urlComponentsObj.fragment) {
      if (!urlComponentsObj.fragment.startsWith("#")) {
        unparsed += "#";
      }
      unparsed+=urlComponentsObj.fragment;
    }
    return unparsed;
  }

  get href() {
    return this.format();
  }

  removeQueryParam(param) {
    if (this._query.hasOwnProperty(param)) {
      delete this._query[param];
    }
  }

  hasQueryParam(param) {
    return this._query.hasOwnProperty(param);
  }

  isSubpageOf(url) {
    var urlPath="",
        basePath="";
    var parsedUrl = new AEMUrl(url);
    if (parsedUrl.path===AUTHOR_PATH || parsedUrl.path===SITEADMIN_PATH) {
      // remove the leading slash, if one is present
      urlPath = parsedUrl.fragment;
    } else {
      urlPath = parsedUrl.path;
    }
    if (this.path===AUTHOR_PATH || this.path===SITEADMIN_PATH) {
      // remove the leading slash, if one is present
      basePath = this.fragment;
    } else {
      basePath = this.path;
    }
    return (parsedUrl.domain === this.domain && trimExt(basePath).startsWith(trimExt(urlPath)));
  }

  getPathSegments(url){
    url = url ? new AEMUrl(url) : this;
    // unfortunately, we can't filter for empty segments, as apparently
    // https://www.domain.com/////// is a valid url -_-
    return url.path.startsWith('/') ? url.path.slice(1).split('/') : url.path.split('/');  
  }

  getRelativePath(baseUrl) {
    var baseUrl = new AEMUrl(baseUrl),
        urlSegments = [],
        basePath = [];
    function isNotInBaseUrl(basePath) {
      // this allows us to choose our own path
      var fragments = basePath ? AEMUrl.prototype.getPathSegments(basePath) : [];
      function inner(segment,i) {
        return segment!==fragments[i];
      }
      return inner;
    }
    if (this.path===AUTHOR_PATH || this.path===SITEADMIN_PATH) {
      urlSegments = this.getPathSegments(this.fragment);
    } else if (this.path.startsWith(TOUCH_PATH)) {
      // if the AEM URL is for the touch UI, the actual page 
      // path begins after 'editor.html'
      urlSegments = this.getPathSegments().slice(1);
    } else {
      urlSegments = this.getPathSegments();
    }
    if (baseUrl.path===AUTHOR_PATH || baseUrl.path===SITEADMIN_PATH){
      basePath = baseUrl.fragment;
    } else if (baseUrl.path.startsWith(TOUCH_PATH)) {
      basePath = baseUrl.path.slice(TOUCH_PATH.length);
    } else {
      basePath = baseUrl.path;
    }
    return urlSegments.filter(isNotInBaseUrl(basePath)).join('/');
  }

  changeEnvironment(oldEnv,newEnv) {
    // console.log("Changing environment from",oldEnv,"to",newEnv);
    var parsedOldEnv = new AEMUrl(oldEnv),
        parsedNewEnv = new AEMUrl(newEnv),
        newUrlObj = new AEMUrl(''),
        newPath,path,ext;
    if (!this.isSubpageOf(parsedOldEnv)) {
      return newEnv.href;
    }
    newPath = this.getRelativePath(parsedOldEnv);
    if (newPath.endsWith("/")) {
      newPath.path = newPath.path.slice(0,-1);
    }
    if (parsedNewEnv.path===AUTHOR_PATH || parsedNewEnv.path===SITEADMIN_PATH) {
      // console.log("author path");
      // if the destination's path is in the fragment
      ext = getExt(this.ext || this.fragment) || HTML_EXT;
      path = trimExt(parsedNewEnv.fragment);
      this.setPreview(parsedNewEnv.isPreview());
      newUrlObj.fragment = AEMUrl.prototype.format({
        path: path.endsWith('/') || !newPath ? [path,newPath].join('') : [path,newPath].join('/'),
        ext: ext,
        query: this.query
      });
      newUrlObj.path = parsedNewEnv.path;
      newUrlObj.ext = parsedNewEnv.ext;
    } else {
      // console.log("normal path")
      // if the destination's path is a normal path
        newUrlObj.path = parsedNewEnv.path.endsWith('/') || !newPath ? [parsedNewEnv.path,newPath].join('') : [parsedNewEnv.path,newPath].join('/');
        if (this.path!==AUTHOR_PATH && this.path!==SITEADMIN_PATH) {
          // author URLs can not have a fragment as it is used to store the path
          newUrlObj.fragment = this.fragment;
        }
        newUrlObj.ext = parsedNewEnv.ext || getExt(parsedNewEnv.fragment);
        newUrlObj.query = this.query; // pass through the query from the current page
        newUrlObj.setPreview(parsedNewEnv.isPreview());
      }
    newUrlObj.protocol = parsedNewEnv.protocol;
    newUrlObj.domain = parsedNewEnv.domain;
    // console.log("Changed environment to:",newUrlObj.href);
    return newUrlObj;
  }

  isSiteAdmin() {
    return this.protocol && this.domain && 
            (this.path===SITEADMIN_PATH)
  }

  isAuthor() {
    return this.protocol && this.domain && 
            (this.path.startsWith(TOUCH_PATH) || this.path===AUTHOR_PATH);
  }

  isPreview() {
    return this.protocol && this.domain && 
            (this.hasQueryParam(WCMMODE) && !this.isAuthor());
  }

  isPublished() {
    return this.protocol && this.domain && 
            !(this.isPreview() || this.isAuthor()); // this could be optimized, but this is clearer
  }

  setPreview(toPreview=true) {
    var parsed;
    if (toPreview) {
      this.query = {[WCMMODE]:"disabled"};
      parsed = new AEMUrl(this.fragment);
      if (this.path.startsWith(TOUCH_PATH)) {
        this.path = '/'+this.getPathSegments().slice(1).join('/');
      } else if (this.path===AUTHOR_PATH) {
        this.path = parsed.path;
        this.ext = parsed.ext;
        this.fragment = "";
      }
    } else {
      this.removeQueryParam(WCMMODE);
    }   
    return this;
  }

  setAuthor(toAuthor=true) {
    var parsed;
    if (toAuthor){
      this.fragment = (this.path===AUTHOR_PATH||this.path===SITEADMIN_PATH) ? this.fragment : this.path
      this.path = AUTHOR_PATH;
      this.ext = "";
      if (this.hasQueryParam(WCMMODE)) {
        this.removeQueryParam(WCMMODE);
      }
    } else {
      if (this.path===AUTHOR_PATH) {
        parsed = new AEMUrl(this.fragment);
        this.path = parsed.path;
        this.ext = parsed.ext;
        this.fragment = "";
      }
    }
    return this;
  }

  setSiteAdmin(toSiteAdmin=true) {
    var parsed;
    if (toSiteAdmin){
      parsed = new AEMUrl((this.path===AUTHOR_PATH||this.path===SITEADMIN_PATH) ? this.fragment : this.path);
      parsed.ext = "";
      this.fragment = parsed.path;
      this.path = SITEADMIN_PATH;
    } else {
      if (this.path===SITEADMIN_PATH) {
        parsed = new AEMUrl(this.fragment);
        this.path = parsed.path;
        this.ext = parsed.ext;
        this.fragment = "";
      }
    }
    return this;
  }
}