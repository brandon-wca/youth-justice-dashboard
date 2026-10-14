/* ==========================================================================
   youth_justice/charts.js
   ==========================================================================
   Draws everything on the Youth Justice Dashboard page. Read top to bottom.

   WHAT HAPPENS WHEN THE PAGE LOADS
     1. Load the two data files: data/data.json (the numbers, built by
        update_data_here/build_data.py) and data/Geography.json (the county outlines).
     2. Fill in the numbers written inside sentences (the <span data-fill> tags in index.html).
     3. Draw the four headline tiles.
     4. Draw the county map, its dropdown, legend, hover box and side panel.
     5. Draw the five story charts with Chart.js (vendor/chart.umd.js).

   Nothing here defines a color; every color is read from styles.css (WCA.colors).

   PART ONE  ·  helpers, all on one object called WCA
     WCA.colors        the brand colors, read from styles.css
     WCA.fmt           number formatting: 6395 -> "6,395", 13.9 -> "13.9%"
     WCA.get           read a value out of data.json by a dotted path
     WCA.fillNumbers   fill the <span data-fill> tags in the page text
     WCA.tooltip       the hover box: show(html, x, y) and hide()
     WCA.legend        write an HTML legend for a chart
     WCA.applyChartDefaults   the look every Chart.js chart shares
     WCA.plugins       two small Chart.js add-ons: value labels at bar ends,
                       and short notes beside chosen points on a line

   PART TWO  ·  this page
     0. Settings
     1. Start-up
     2. Headline tiles
     3. Map
     4. Story charts (1 to 5)
     5. Small helpers
   ========================================================================== */


/* ##########################################################################
   PART ONE  ·  HELPERS
   ########################################################################## */

const WCA = {};


/* --------------------------------------------------------------------------
   COLORS  ·  read from the CSS variables in styles.css
   --------------------------------------------------------------------------
   Keeping the values in CSS means styles.css is the only place a color
   is defined. WCA.colors.blue is the same value as var(--wca-blue). */

WCA.cssVar = function (name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

WCA.colors = {
  blue:      WCA.cssVar("--wca-blue"),
  green:     WCA.cssVar("--wca-green"),
  blue100:   WCA.cssVar("--wca-blue-100"),
  blue200:   WCA.cssVar("--wca-blue-200"),
  blue300:   WCA.cssVar("--wca-blue-300"),
  blue500:   WCA.cssVar("--wca-blue-500"),
  blue700:   WCA.cssVar("--wca-blue-700"),
  orange:    WCA.cssVar("--wca-orange"),
  orange100: WCA.cssVar("--wca-orange-100"),
  ink:       WCA.cssVar("--ink"),
  body:      WCA.cssVar("--body"),
  fine:      WCA.cssVar("--fine"),
  muted:     WCA.cssVar("--muted"),
  rule:      WCA.cssVar("--rule"),
  panel:     WCA.cssVar("--panel"),
  noData:    WCA.cssVar("--map-no-data"),
};

WCA.font = WCA.cssVar("--font");

/* The blue ramp for maps: 5 steps, light to dark. One hue, so darker always means more. */
WCA.blueRamp = [WCA.colors.blue100, WCA.colors.blue200, WCA.colors.blue300, WCA.colors.blue500, WCA.colors.blue700];


/* --------------------------------------------------------------------------
   NUMBER FORMATTING
   -------------------------------------------------------------------------- */

WCA.fmt = {
  /* 6395 -> "6,395" */
  count: function (n) {
    if (n === null || n === undefined) return "n/a";
    return Number(n).toLocaleString("en-US");
  },

  /* 13.9 -> "13.9%". Shares in data.json are already rounded to one decimal. */
  pct: function (n, decimals) {
    if (n === null || n === undefined) return "n/a";
    if (decimals === undefined) decimals = 1;
    return Number(n).toFixed(decimals) + "%";
  },

  /* 10.1 -> "+10.1%", -4.9 -> "−4.9%" (a real minus sign) */
  change: function (n, decimals) {
    if (n === null || n === undefined) return "n/a";
    if (decimals === undefined) decimals = 1;
    var sign = n > 0 ? "+" : (n < 0 ? "−" : "");
    return sign + Math.abs(Number(n)).toFixed(decimals) + "%";
  },

  /* Pick the right formatter for a unit named in data.json ("count", "%", "change") */
  byUnit: function (n, unit) {
    if (unit === "%") return WCA.fmt.pct(n);
    if (unit === "change") return WCA.fmt.change(n);
    return WCA.fmt.count(n);
  },
};


/* --------------------------------------------------------------------------
   READ FROM data.json BY PATH
   --------------------------------------------------------------------------
   WCA.get(data, "charts.by_place.values.0") -> 22.6
   Used to fill numbers written in the page text, so the text can never
   disagree with the data. */

WCA.get = function (object, path) {
  var parts = path.split(".");
  var value = object;
  for (var i = 0; i < parts.length; i++) {
    if (value === null || value === undefined) return undefined;
    value = value[parts[i]];
  }
  return value;
};

/* Fill every element with a data-fill attribute:
     <span data-fill="headlines.0.value" data-format="count"></span>
   data-format is count (default), pct or change. */
WCA.fillNumbers = function (data) {
  var elements = document.querySelectorAll("[data-fill]");
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var value = WCA.get(data, el.getAttribute("data-fill"));
    var format = el.getAttribute("data-format") || "count";
    if (format === "raw") el.textContent = value;
    else if (format === "pct") el.textContent = WCA.fmt.pct(value);
    else if (format === "pct0") el.textContent = WCA.fmt.pct(value, 0);
    else if (format === "change") el.textContent = WCA.fmt.change(value);
    else if (format === "change0") el.textContent = WCA.fmt.change(value, 0);
    else el.textContent = WCA.fmt.count(value);
  }
};


/* --------------------------------------------------------------------------
   TOOLTIP  ·  one hover box for the whole page (used by the map)
   -------------------------------------------------------------------------- */

WCA.tooltip = {
  element: null,

  /* Make the box the first time it's needed */
  init: function () {
    if (WCA.tooltip.element) return;
    var box = document.createElement("div");
    box.className = "tooltip";
    document.body.appendChild(box);
    WCA.tooltip.element = box;
  },

  /* Show html near the mouse position (x, y are page pixels from the event) */
  show: function (html, x, y) {
    WCA.tooltip.init();
    var box = WCA.tooltip.element;
    box.innerHTML = html;
    box.classList.add("show");
    /* Keep the box on screen: flip it to the left near the right edge */
    var pad = 14;
    var left = x + pad;
    if (left + box.offsetWidth > window.innerWidth - 8) left = x - pad - box.offsetWidth;
    var top = y + pad;
    if (top + box.offsetHeight > window.innerHeight - 8) top = y - pad - box.offsetHeight;
    box.style.left = left + "px";
    box.style.top = top + "px";
  },

  hide: function () {
    if (WCA.tooltip.element) WCA.tooltip.element.classList.remove("show");
  },
};


/* --------------------------------------------------------------------------
   HTML LEGEND
   --------------------------------------------------------------------------
   WCA.legend(container, [{label: "Westchester", color: "#098342"}, ...])
   Writes a row of color swatches with labels. Charts with two or more series
   always get one, so a reader never has to guess from color alone. */

WCA.legend = function (container, items) {
  if (typeof container === "string") container = document.querySelector(container);
  var html = "";
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var swatch = item.pattern
      ? '<span class="swatch" style="background:' + item.pattern + '"></span>'
      : '<span class="swatch" style="background:' + item.color + '"></span>';
    html += '<span class="legend-item">' + swatch + item.label + "</span>";
  }
  container.innerHTML = html;
};


/* --------------------------------------------------------------------------
   CHART.JS DEFAULTS  ·  the look every chart shares
   --------------------------------------------------------------------------
   Called once by the dashboard before it draws anything. Thin marks, light
   solid gridlines, WCA font and text colors, tooltips in the house style. */

WCA.applyChartDefaults = function () {
  var d = Chart.defaults;
  d.font.family = WCA.font;
  d.font.size = 13;
  d.color = WCA.colors.body;                 /* axis labels and legend text */
  d.responsive = true;
  d.maintainAspectRatio = false;             /* the .chart-box height decides */
  d.animation = false;                       /* nothing moves; easier to read and to screenshot */

  d.plugins.legend.display = false;          /* legends are written in HTML (WCA.legend) */
  d.plugins.tooltip.backgroundColor = WCA.colors.ink;
  d.plugins.tooltip.titleFont = { family: WCA.font, size: 13, weight: "600" };
  d.plugins.tooltip.bodyFont = { family: WCA.font, size: 13 };
  d.plugins.tooltip.padding = 8;
  d.plugins.tooltip.cornerRadius = 6;
  d.plugins.tooltip.displayColors = false;

  d.scale.grid.color = WCA.colors.panel;     /* faint, solid gridlines */
  d.scale.grid.drawTicks = false;
  d.scale.border.display = false;
  d.scale.ticks.color = WCA.colors.fine;
  d.scale.ticks.padding = 6;

  d.elements.bar.borderRadius = 4;           /* rounded data ends */
  d.elements.bar.borderSkipped = "start";    /* ...but square at the baseline */
  d.elements.line.borderWidth = 2;
  d.elements.line.tension = 0;               /* straight segments between points */
  d.elements.point.radius = 4;
  d.elements.point.hoverRadius = 6;
  d.elements.point.hitRadius = 12;           /* easy to hover without landing dead center */
};


/* --------------------------------------------------------------------------
   SMALL CHART.JS ADD-ONS ("plugins")
   --------------------------------------------------------------------------
   Chart.js lets us draw extra things after it draws the chart. These two are
   all the dashboards need, so we don't load a plugin library. */

WCA.plugins = {};

/* valueLabels: write each bar's value just past its end.
   Works for vertical and horizontal bars, and for the first segment of a stack.
   Turn on per chart with:
     plugins: { valueLabels: { datasets: [0], format: WCA.fmt.pct } }
   datasets = which series to label (by index); format = how to write the number. */
WCA.plugins.valueLabels = {
  id: "valueLabels",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || !options.datasets) return;
    var ctx = chart.ctx;
    var horizontal = chart.options.indexAxis === "y";
    ctx.save();
    ctx.font = "600 13px " + WCA.font;
    ctx.fillStyle = WCA.colors.ink;         /* text wears text color, not the series color */
    options.datasets.forEach(function (datasetIndex) {
      var meta = chart.getDatasetMeta(datasetIndex);
      var values = chart.data.datasets[datasetIndex].data;
      meta.data.forEach(function (bar, i) {
        var value = values[i];
        if (value === null || value === undefined) return;
        var text = options.format ? options.format(value) : String(value);
        if (horizontal) {
          ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText(text, bar.x + 6, bar.y);
        } else {
          ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.fillText(text, bar.x, bar.y - 4);
        }
      });
    });
    ctx.restore();
  },
};

/* pointNotes: a short note beside chosen points on a line chart, e.g. the
   value at the first and last point, or "COVID-19 low" at 2021.
   Turn on per chart with:
     plugins: { pointNotes: { notes: [ {dataset: 0, index: 2, text: "COVID-19 low", place: "below"} ] } }
   place is "above" (default) or "below". */
WCA.plugins.pointNotes = {
  id: "pointNotes",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || !options.notes) return;
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = "600 12px " + WCA.font;
    ctx.fillStyle = WCA.colors.ink;
    ctx.textAlign = "center";
    options.notes.forEach(function (note) {
      var meta = chart.getDatasetMeta(note.dataset || 0);
      var point = meta.data[note.index];
      if (!point) return;
      /* keep the text inside the chart area, left or right */
      var x = Math.min(Math.max(point.x, chart.chartArea.left + 28), chart.chartArea.right - 28);
      if (note.place === "below") { ctx.textBaseline = "top";    ctx.fillText(note.text, x, point.y + 8); }
      else                        { ctx.textBaseline = "bottom"; ctx.fillText(note.text, x, point.y - 8); }
    });
    ctx.restore();
  },
};


/* ##########################################################################
   PART TWO  ·  THIS PAGE
   ########################################################################## */

/* --------------------------------------------------------------------------
   0. SETTINGS  ·  the things a person might change
   -------------------------------------------------------------------------- */

var DATA_FILE = "data/data.json";
var GEOGRAPHY_FILE = "data/Geography.json";

/* The county shown in the side panel when the page opens. 36119 = Westchester. */
var DEFAULT_COUNTY = "36119";

/* How each map measure's counts are written out. The key matches data.json "map.measures".
     counts  how to describe the two counts behind a value: {n} and {d} are filled in,
             {latest} and {base} are the years from data.json "meta"
     noun    the word for what is counted, used in the "too few" message
   (How the value itself is written, 13.9% or +4.9%, comes from the measure's "unit" in data.json.) */
var MEASURE_TEXT = {
  criminal_court_share:      { counts: "{n} of {d} cases",                      noun: "cases" },
  arrests_change_since_2019: { counts: "{n} arrests in {latest}, {d} in {base}", noun: "arrests" },
  black_share_of_arrests:    { counts: "{n} of {d} arrests",                    noun: "arrests" },
};

/* Shorter labels for the places in chart 3 and chart 5, broken into lines so they fit beside the bars.
   Keys are the labels as they come from data.json. Anything not listed is wrapped automatically. */
var PLACE_LABELS = {
  "55 counties outside NYC, Westchester and Nassau": ["55 counties outside NYC,", "Westchester and Nassau"],
  "Rest of state excluding Westchester": ["Rest of state", "(excluding Westchester)"],
};


/* --------------------------------------------------------------------------
   1. START-UP  ·  load both files, then draw everything
   -------------------------------------------------------------------------- */

Promise.all([
  fetch(DATA_FILE).then(function (r) { if (!r.ok) throw new Error(DATA_FILE + " not found"); return r.json(); }),
  fetch(GEOGRAPHY_FILE).then(function (r) { if (!r.ok) throw new Error(GEOGRAPHY_FILE + " not found"); return r.json(); }),
]).then(function (files) {
  var data = files[0];
  var geography = files[1];

  WCA.applyChartDefaults();
  WCA.fillNumbers(data);

  drawHeadlines(data);
  drawMap(data, geography);

  drawArrestsTrend(data);
  drawCriminalCourtByYear(data);
  drawByPlace(data);
  drawSentences(data);
  drawArrestsByRace(data);
}).catch(function (error) {
  /* Most likely cause: the page was opened straight from a folder (file://), which
     blocks loading data files. It needs a web server; see the README. */
  document.getElementById("tiles").innerHTML =
    '<p class="fine">Couldn\'t load the data (' + error.message + '). ' +
    'This page has to be opened through a web server, not straight from a folder. See the README.</p>';
  console.error(error);
});


/* --------------------------------------------------------------------------
   2. HEADLINE TILES  ·  one tile per entry in data.json "headlines"
   -------------------------------------------------------------------------- */

function drawHeadlines(data) {
  var html = "";
  data.headlines.forEach(function (h) {
    var value = typeof h.value === "number" ? WCA.fmt.byUnit(h.value, h.unit) : h.value;
    html += '<div class="tile">';
    html += '  <div class="value">' + value + "</div>";
    html += '  <div class="label">' + h.label + "</div>";
    if (h.compare) {
      html += '  <div class="compare">' + capitalize(h.compare.label) + ": " +
              WCA.fmt.byUnit(h.compare.value, h.compare.unit) + "</div>";
    }
    html += "</div>";
  });
  document.getElementById("tiles").innerHTML = html;
}


/* --------------------------------------------------------------------------
   3. MAP  ·  New York's 62 counties, colored by the chosen measure
   --------------------------------------------------------------------------
   How it works:
     a. Each county's outline comes as longitude/latitude points. projectPoints()
        turns them into x/y on the drawing, scaled to fit the SVG box.
     b. One SVG <path> is drawn per county (once). Changing the measure only
        changes each path's fill color.
     c. Colors: share measures use the 5-step blue ramp (darker = more).
        The change measure uses orange for "fewer than 2019" and blue for "more",
        with gray at no change. Counties flagged "too few cases" get hatching.
     d. Hovering shows a tooltip; clicking fills the side panel with that county
        next to the state. Westchester is outlined in green and selected at the start.
   -------------------------------------------------------------------------- */

var map = {
  data: null,             /* data.json "map" */
  svg: null,
  group: null,            /* the <g> that holds the county paths */
  paths: {},              /* county code -> its <path> */
  measureKey: null,       /* which measure is showing */
  selected: null,         /* county code shown in the side panel */
  scale: null,            /* the color scale for the current measure */
};

function drawMap(data, geography) {
  map.data = data.map;
  map.meta = data.meta;
  map.svg = document.getElementById("map");
  map.group = document.getElementById("map-counties");

  /* a. Fit the outlines into the SVG box (720 x 560, see index.html) with a little margin */
  var project = makeProjection(geography.features, 720, 560, 8);

  /* b. One path per county */
  geography.features.forEach(function (feature) {
    var code = feature.properties.county_fips;
    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathFor(feature.geometry, project));
    path.setAttribute("class", "county");
    path.dataset.code = code;
    path.dataset.name = feature.properties.county_name;
    path.addEventListener("mousemove", function (e) { showCountyTooltip(code, e.clientX, e.clientY); });
    path.addEventListener("mouseleave", WCA.tooltip.hide);
    path.addEventListener("click", function () { selectCounty(code); });
    map.group.appendChild(path);
    map.paths[code] = path;
  });

  /* Westchester's outline is green, always; keep it drawn on top of its neighbours */
  var highlight = map.paths[map.data.highlight_county];
  if (highlight) { highlight.classList.add("highlight"); map.group.appendChild(highlight); }

  /* The dropdown lists the measures in data.json */
  var select = document.getElementById("map-measure");
  Object.keys(map.data.measures).forEach(function (key) {
    var option = document.createElement("option");
    option.value = key;
    option.textContent = map.data.measures[key].label;
    select.appendChild(option);
  });
  select.value = map.data.default_measure;
  select.addEventListener("change", function () { showMeasure(select.value); });

  showMeasure(map.data.default_measure);
  selectCounty(DEFAULT_COUNTY);
}

/* Color every county for one measure, and rewrite the legend and source line */
function showMeasure(key) {
  map.measureKey = key;
  var measure = map.data.measures[key];
  map.scale = makeColorScale(key, measure);

  Object.keys(map.paths).forEach(function (code) {
    var entry = measure.counties[code];
    map.paths[code].setAttribute("fill", fillFor(entry));
  });

  WCA.legend("#map-legend", map.scale.legend.concat([
    { label: "Too few cases", pattern: "repeating-linear-gradient(45deg, #B5B5B5 0 1px, #F4F4F4 1px 5px)" },
  ]));
  /* The source line names the warehouse table (the part of "source" before the comma) */
  document.getElementById("map-source").textContent =
    "Source: NYS DCJS, table " + measure.source.split(",")[0] + ". " + measure.description;

  WCA.tooltip.hide();
  if (map.selected) fillSidePanel(map.selected);
}

/* The fill color for one county entry under the current scale */
function fillFor(entry) {
  if (!entry || entry.value === null || entry.value === undefined) return WCA.colors.noData;
  if (entry.too_few) return "url(#hatch)";
  return map.scale.color(entry.value);
}

/* Build the color scale for a measure: which value gets which color, plus the legend.
   Share measures: 5 equal steps from 0 up to a round number above the highest county.
   Change measure: two steps each side of "no change", the step being a round number. */
function makeColorScale(key, measure) {
  var values = [];
  Object.keys(measure.counties).forEach(function (code) {
    var e = measure.counties[code];
    if (e.value !== null && e.value !== undefined && !e.too_few) values.push(e.value);
  });

  if (measure.unit === "change") {
    var biggest = Math.max.apply(null, values.map(Math.abs));
    var step = roundStep(biggest / 2);                  /* e.g. 25 (%) */
    var colors = [WCA.colors.orange, WCA.colors.orange100, WCA.colors.rule, WCA.colors.blue200, WCA.colors.blue500];
    return {
      color: function (v) {
        if (v <= -step) return colors[0];
        if (v < 0)      return colors[1];
        if (v === 0)    return colors[2];
        if (v < step)   return colors[3];
        return colors[4];
      },
      legend: [
        { label: "Down " + step + "% or more",   color: colors[0] },
        { label: "Down less than " + step + "%", color: colors[1] },
        { label: "No change",                    color: colors[2] },
        { label: "Up less than " + step + "%",   color: colors[3] },
        { label: "Up " + step + "% or more",     color: colors[4] },
      ],
    };
  }

  /* Share measures */
  var top = Math.max.apply(null, values);
  var width = roundStep(top / 5);                       /* e.g. 10 (%) */
  var ramp = WCA.blueRamp;
  var legend = [];
  for (var i = 0; i < ramp.length; i++) {
    var from = i * width, to = (i + 1) * width;
    legend.push({ label: i === ramp.length - 1 ? from + "% or more" : from + "–" + to + "%", color: ramp[i] });
  }
  return {
    color: function (v) {
      var bin = Math.min(ramp.length - 1, Math.floor(v / width));
      return ramp[bin];
    },
    legend: legend,
  };
}

/* The hover box for a county */
function showCountyTooltip(code, x, y) {
  var measure = map.data.measures[map.measureKey];
  var entry = measure.counties[code];
  var text = MEASURE_TEXT[map.measureKey];
  var html = "<strong>" + entry.name + "</strong><br>";
  if (entry.value === null || entry.value === undefined) {
    html += "No " + text.noun + " recorded";
  } else if (entry.too_few) {
    html += "Too few " + text.noun + " for a reliable figure<br>" + countsText(entry, text);
  } else {
    html += WCA.fmt.byUnit(entry.value, measure.unit) + "<br>" + countsText(entry, text);
  }
  WCA.tooltip.show(html, x, y);
}

/* Mark a county as selected and show it in the side panel */
function selectCounty(code) {
  if (map.selected && map.paths[map.selected]) map.paths[map.selected].classList.remove("selected");
  map.selected = code;
  var path = map.paths[code];
  path.classList.add("selected");
  map.group.appendChild(path);           /* on top, so the outline isn't hidden by neighbours */
  fillSidePanel(code);
}

/* The side panel: the selected county next to the state, for the current measure */
function fillSidePanel(code) {
  var measure = map.data.measures[map.measureKey];
  var text = MEASURE_TEXT[map.measureKey];
  var county = measure.counties[code];
  var state = measure.state;
  var isWestchester = code === map.data.highlight_county;

  function block(who, entry, cssClass) {
    var value, counts;
    if (entry.value === null || entry.value === undefined) { value = "n/a"; counts = "No " + text.noun + " recorded"; }
    else if (entry.too_few) { value = "Too few"; counts = countsText(entry, text) + " — too few for a reliable figure"; }
    else { value = WCA.fmt.byUnit(entry.value, measure.unit); counts = countsText(entry, text); }
    return '<div><div class="who">' + who + '</div><div class="big ' + cssClass + '">' + value +
           '</div><div class="counts">' + counts + "</div></div>";
  }

  document.getElementById("side-panel").innerHTML =
    "<h3>" + county.name + (isWestchester ? "" : " County") + "</h3>" +
    '<div class="measure-name">' + measure.label + "</div>" +
    '<div class="compare">' +
      block(county.name, county, isWestchester ? "westchester" : "") +
      block("New York State", state, "") +
    "</div>" +
    '<div class="note">' + measure.description + "</div>" +
    '<div class="hint">Click another county on the map to compare it.</div>';
}

/* "57 of 409 cases", using the measure's own wording */
function countsText(entry, text) {
  return text.counts
    .replace("{n}", WCA.fmt.count(entry.numerator))
    .replace("{d}", WCA.fmt.count(entry.denominator))
    .replace("{latest}", map.meta.latest_year)
    .replace("{base}", map.meta.base_year);
}

/* --- Map geometry ---------------------------------------------------------- */

/* Turn longitude/latitude into drawing coordinates.
   Uses the Web Mercator formula (the one web maps use) so the state's shape looks right,
   then scales and centres everything to fit the box. Returns a function (lon, lat) -> [x, y]. */
function makeProjection(features, width, height, margin) {
  function mercator(lon, lat) {
    var x = lon * Math.PI / 180;
    var y = Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
    return [x, y];
  }
  /* Find the bounds of every point, projected */
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  features.forEach(function (f) {
    eachRing(f.geometry, function (ring) {
      ring.forEach(function (p) {
        var xy = mercator(p[0], p[1]);
        if (xy[0] < minX) minX = xy[0]; if (xy[0] > maxX) maxX = xy[0];
        if (xy[1] < minY) minY = xy[1]; if (xy[1] > maxY) maxY = xy[1];
      });
    });
  });
  var scale = Math.min((width - 2 * margin) / (maxX - minX), (height - 2 * margin) / (maxY - minY));
  var offsetX = (width - (maxX - minX) * scale) / 2;
  var offsetY = (height - (maxY - minY) * scale) / 2;
  return function (lon, lat) {
    var xy = mercator(lon, lat);
    return [ (xy[0] - minX) * scale + offsetX, (maxY - xy[1]) * scale + offsetY ];   /* y flipped: north is up */
  };
}

/* Call fn(ring) for every ring of a Polygon or MultiPolygon */
function eachRing(geometry, fn) {
  var polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  polygons.forEach(function (polygon) { polygon.forEach(fn); });
}

/* The SVG path text ("M x,y L x,y ... Z") for a county's outline */
function pathFor(geometry, project) {
  var d = "";
  eachRing(geometry, function (ring) {
    ring.forEach(function (p, i) {
      var xy = project(p[0], p[1]);
      d += (i === 0 ? "M" : "L") + xy[0].toFixed(1) + "," + xy[1].toFixed(1);
    });
    d += "Z";
  });
  return d;
}


/* --------------------------------------------------------------------------
   4. STORY CHARTS  ·  Chart.js, one function per chart
   -------------------------------------------------------------------------- */

/* Chart 1: felony arrests of people under 18 by year, as two small panels
   (New York State and Westchester) so each has its own scale. */
function drawArrestsTrend(data) {
  var chart = data.charts.arrests_trend;

  function panel(canvasId, place, color) {
    var values = chart.series[place];
    var notes = [
      { index: 0,                 text: WCA.fmt.count(values[0]) },                  /* first year's value */
      { index: values.length - 1, text: WCA.fmt.count(values[values.length - 1]) },  /* latest year's value */
    ];
    /* Notes from data.json, e.g. {"2021": "COVID-19 low"}, go under the point */
    Object.keys(chart.notes || {}).forEach(function (year) {
      var i = chart.years.indexOf(Number(year));
      if (i >= 0) notes.push({ index: i, text: chart.notes[year], place: "below" });
    });

    new Chart(document.getElementById(canvasId), {
      type: "line",
      data: {
        labels: chart.years,
        datasets: [{ label: place, data: values, borderColor: color, backgroundColor: color, pointBackgroundColor: color }],
      },
      options: {
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, grace: "20%", ticks: { callback: WCA.fmt.count, maxTicksLimit: 5 } },
        },
        plugins: {
          pointNotes: { notes: notes },
          tooltip: { callbacks: {
            title: function (items) { return place + ", " + items[0].label; },
            label: function (item) { return WCA.fmt.count(item.parsed.y) + " felony arrests"; },
          } },
        },
      },
      plugins: [WCA.plugins.pointNotes],
    });
  }

  panel("chart-arrests-state", "New York State", WCA.colors.blue);
  panel("chart-arrests-westchester", "Westchester", WCA.colors.green);
}


/* Chart 2: share of AO cases kept in criminal court vs moved to Family Court, by year.
   One stacked bar per year; the two segments add up to 100%. */
function drawCriminalCourtByYear(data) {
  var chart = data.charts.criminal_court_by_year;
  var kept = { label: "Kept in criminal court", color: WCA.colors.blue };
  var moved = { label: "Moved to Family Court or probation", color: WCA.colors.blue100 };

  WCA.legend("#legend-criminal-court", [kept, moved]);

  new Chart(document.getElementById("chart-criminal-court"), {
    type: "bar",
    data: {
      labels: chart.years,
      datasets: [
        { label: kept.label,  data: chart.criminal_court, backgroundColor: kept.color,
          borderColor: "#FFFFFF", borderWidth: { top: 2 } },             /* a thin white gap between the segments */
        { label: moved.label, data: chart.family_court,   backgroundColor: moved.color },
      ],
    },
    options: {
      datasets: { bar: { barPercentage: 0.55 } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, min: 0, max: 100, ticks: { callback: function (v) { return v + "%"; }, stepSize: 25 } },
      },
      plugins: {
        valueLabels: { datasets: [0], format: WCA.fmt.pct },           /* the kept share, written above its segment */
        tooltip: { callbacks: {
          label: function (item) {
            var line = item.dataset.label + ": " + WCA.fmt.pct(item.parsed.y);
            if (item.datasetIndex === 0) line += " of " + WCA.fmt.count(chart.cases[item.dataIndex]) + " cases";
            return line;
          },
        } },
      },
    },
    plugins: [WCA.plugins.valueLabels],
  });
}


/* Chart 3: share of AO cases kept in criminal court in four places. Horizontal bars;
   Westchester's bar is green (green = Westchester, everywhere on the page). */
function drawByPlace(data) {
  var chart = data.charts.by_place;

  new Chart(document.getElementById("chart-by-place"), {
    type: "bar",
    data: {
      labels: chart.places.map(placeLabel),
      datasets: [{
        data: chart.values,
        backgroundColor: chart.places.map(function (p) { return p === "Westchester" ? WCA.colors.green : WCA.colors.blue; }),
      }],
    },
    options: horizontalBarOptions({
      valueLabels: { datasets: [0], format: WCA.fmt.pct },
      tooltip: { callbacks: {
        title: function (items) { return chart.places[items[0].dataIndex]; },
        label: function (item) { return WCA.fmt.pct(item.parsed.x) + " of " + WCA.fmt.count(chart.cases[item.dataIndex]) + " cases"; },
      } },
    }),
    plugins: [WCA.plugins.valueLabels],
  });
}


/* Chart 4: share of AO sentences that were confinement of a year or more,
   Black and white youth, outside New York City. Two horizontal bars. */
function drawSentences(data) {
  var chart = data.charts.sentences_by_race;

  new Chart(document.getElementById("chart-sentences"), {
    type: "bar",
    data: {
      labels: chart.groups.map(function (g) { return g + " youth"; }),
      datasets: [{ data: chart.confinement_1yr_plus, backgroundColor: WCA.colors.blue }],
    },
    options: horizontalBarOptions({
      valueLabels: { datasets: [0], format: WCA.fmt.pct },
      tooltip: { callbacks: {
        label: function (item) { return WCA.fmt.pct(item.parsed.x) + " of " + WCA.fmt.count(chart.sentences[item.dataIndex]) + " sentences"; },
      } },
    }),
    plugins: [WCA.plugins.valueLabels],
  });
}


/* Chart 5: each group's share of under-18 felony arrests, Westchester vs the rest of
   the state. Grouped horizontal bars, one row per group. */
function drawArrestsByRace(data) {
  var chart = data.charts.arrests_by_race;
  var placeA = "Westchester";
  var placeB = "Rest of state excluding Westchester";
  var a = chart.places[placeA];
  var b = chart.places[placeB];

  WCA.legend("#legend-arrests-race", [
    { label: placeA + " (" + WCA.fmt.count(a.arrests) + " arrests)", color: WCA.colors.green },
    { label: placeLabel(placeB).join(" ") + " (" + WCA.fmt.count(b.arrests) + " arrests)", color: WCA.colors.blue },
  ]);

  new Chart(document.getElementById("chart-arrests-race"), {
    type: "bar",
    data: {
      labels: chart.groups,
      datasets: [
        { label: placeA, data: a.shares, backgroundColor: WCA.colors.green },
        { label: placeB, data: b.shares, backgroundColor: WCA.colors.blue },
      ],
    },
    options: horizontalBarOptions({
      valueLabels: { datasets: [0, 1], format: WCA.fmt.pct },
      tooltip: { callbacks: {
        label: function (item) {
          var arrests = item.datasetIndex === 0 ? a.arrests : b.arrests;
          return item.dataset.label + ": " + WCA.fmt.pct(item.parsed.x) + " of " + WCA.fmt.count(arrests) + " arrests";
        },
      } },
    }),
    plugins: [WCA.plugins.valueLabels],
  });
}


/* --------------------------------------------------------------------------
   5. SMALL HELPERS
   -------------------------------------------------------------------------- */

/* The options every horizontal bar chart shares: bars run left to right, the value axis
   shows percentages, room on the right for the value labels. `plugins` adds the chart's own. */
function horizontalBarOptions(plugins) {
  return {
    indexAxis: "y",
    datasets: { bar: { barPercentage: 0.7, categoryPercentage: 0.75 } },
    layout: { padding: { right: 48 } },
    scales: {
      x: { beginAtZero: true, grace: "10%", ticks: { callback: function (v) { return v + "%"; }, maxTicksLimit: 6 } },
      y: { grid: { display: false } },
    },
    plugins: plugins,
  };
}

/* A place name as one or more lines for a bar's label (see PLACE_LABELS in Settings) */
function placeLabel(place) {
  if (PLACE_LABELS[place]) return PLACE_LABELS[place];
  return wrap(place, 24);
}

/* Break text into lines of about `width` characters, at spaces */
function wrap(text, width) {
  var words = text.split(" "), lines = [], line = "";
  words.forEach(function (word) {
    if ((line + " " + word).trim().length > width && line) { lines.push(line); line = word; }
    else line = (line + " " + word).trim();
  });
  if (line) lines.push(line);
  return lines;
}

/* 23 -> 25, 7 -> 10, 2.4 -> 2.5 : a round number at or above x, for legend steps */
function roundStep(x) {
  var candidates = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 100];
  for (var i = 0; i < candidates.length; i++) if (candidates[i] >= x) return candidates[i];
  return Math.ceil(x / 100) * 100;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
