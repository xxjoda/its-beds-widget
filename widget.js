/* Licence: juliankern.com; CC BY 3.0 DE */
const apiUrlBase = 'http://intensiv-widget.juliankern.com/beds';
const getApiUrl = (location, state) => {
  if (location) { return `${apiUrlBase}?lat=${location.latitude.toFixed(3)}&lng=${location.longitude.toFixed(3)}`; }
  if (state) { return `${apiUrlBase}?state=${state}`; }
  return apiUrlBase;
}

const defaultCfg = {
  layout: 'simple',
};

const CONFIG = Object.assign({}, defaultCfg, arguments[0]);

init();

async function init() {
  const widget = await createWidget();
  if (!config.runsInWidget) {
    await widget.presentSmall();
  }

  console.log(CONFIG.layout);

  Script.setWidget(widget);
  Script.complete();
}

async function createWidget(items) {
  const data = await getData();
  const list = new ListWidget();
  const header = list.addText("🛏 Freie ITS-Betten");
  header.font = Font.mediumSystemFont(12);

  if (data) {
    list.addSpacer();
    const weekData = saveLoadData(data, data.state.shortName)
    
    if (data.state) {
      
      const label = list.addText(data.state.used.toFixed(2) + "%");
      label.font = Font.mediumSystemFont(22);
      label.textColor = data.state.used <= 25 ? Color.red() : data.state.used <= 50 ? Color.orange() : Color.green();
      
      const bedsLabel = list.addStack();
      bedsLabel.layoutHorizontally();
      bedsLabel.centerAlignContent();
      bedsLabel.useDefaultPadding();
      
      if (CONFIG.layout === 'extended') {
        const location = bedsLabel.addText(data.state.shortName + ' ');
        location.font = Font.mediumSystemFont(12);
        location.textColor = Color.lightGray();

        const label = bedsLabel.addText(`${data.state.absolute.free}/${data.state.absolute.total} ${getBedsStateTrend(data, weekData)}`);
        label.font = Font.mediumSystemFont(12);
        label.textColor = data.state.used <= 25 ? Color.red() : data.state.used <= 50 ? Color.orange() : Color.green();
      } else {
        const location = bedsLabel.addText(data.state.name);
        location.font = Font.lightSystemFont(12);
      }
      
      list.addSpacer(4);
    }

    
    const label = list.addText(data.overall.used.toFixed(2) + "%");
    label.font = Font.mediumSystemFont(22);
    label.textColor = data.overall.used <= 25 ? Color.red() : data.overall.used <= 50 ? Color.orange() : Color.green();
    
    const bedsLabel = list.addStack();
    bedsLabel.layoutHorizontally();
    bedsLabel.centerAlignContent();
    bedsLabel.useDefaultPadding();
    
    if (CONFIG.layout === 'extended') {
      const location = bedsLabel.addText('DE ');
      location.font = Font.mediumSystemFont(12);
      location.textColor = Color.lightGray();

      const label = bedsLabel.addText(`${data.overall.absolute.free}/${data.overall.absolute.total} ${getBedsTrend(data, weekData)}`);
      label.font = Font.mediumSystemFont(12);
      label.textColor = data.overall.used <= 25 ? Color.red() : data.overall.used <= 50 ? Color.orange() : Color.green();
    } else {
      const location = list.addText('Deutschland');
      location.font = Font.lightSystemFont(12);
    }

    list.refreshAfterDate = new Date(Date.now() + (1000 * 60 * 30));

    list.addSpacer(6);
    const dateFormatter = new DateFormatter();
    dateFormatter.useShortDateStyle();
    dateFormatter.useShortTimeStyle();

    const updated = list.addText(`↻ ${dateFormatter.string(new Date(data.overall.updated))}`);
    updated.font = Font.lightSystemFont(9);
    updated.textColor = Color.gray();
  } else {
    list.addSpacer();
    list.addText("Daten nicht verfügbar");
  }

  return list;
}

async function getData() {
  try {
    let foundData;
    
    if (args.widgetParameter) {
      foundData = await new Request(getApiUrl(null, args.widgetParameter)).loadJSON();
    } else {
      const location = await getLocation();
      foundData = await new Request(getApiUrl(location)).loadJSON();
    }

    return foundData;
  } catch (e) {
    return null;
  }
}

async function getLocation() {
  try {
    Location.setAccuracyToThreeKilometers();
    return await Location.current();
  } catch (e) {
    return null;
  }
}

function getBedsTrend(data, weekdata) {
  let bedsTrend = ' ';
  
  if (Object.keys(weekdata).length > 0) {
    const prevData = getDataForDate(weekdata);
  
    if (prevData) {
      bedsTrend = (data.overall.absolute.free < prevData.overall.absolute.free) ? '↓' : '↑';
    }
  }
  
  return bedsTrend;
}

function getBedsStateTrend(data, weekdata) {
  let bedsTrend = ' ';
  
  if (Object.keys(weekdata).length > 0) {
    const prevData = getDataForDate(weekdata);
    
    if (prevData) {
      bedsTrend = (data.state.absolute.free < prevData.state.absolute.free) ? '↓' : '↑';
    }
  }

  return bedsTrend;
}

function getDataForDate(weekdata, yesterday = true, datestr = '') {
  let dateKey = datestr;
  let dayOffset = 1;
  const today = new Date();
  const todayDateKey = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;

  if (typeof weekdata[todayDateKey] === 'undefined') {
    dayOffset = 2;
  }

  if (yesterday) {
    today.setDate(today.getDate() - dayOffset);
    dateKey = `${today.getDate()}.${today.getMonth() + 1}.${today.getFullYear()}`;
  }

  if (typeof weekdata[dateKey] !== 'undefined') {
    return weekdata[dateKey];
  }

  return false;
}

function saveLoadData(newData, suffix = '') {
  const updated = newData.overall.updated.substr(0, 10);
  const loadedData = loadData(suffix);

  if (loadedData) {
    loadedData[updated] = newData;

    const loadedDataKeys = Object.keys(loadedData);
    const lastDaysKeys = loadedDataKeys.slice(Math.max(Object.keys(loadedData).length - 7, 0));

    let loadedDataLimited = {};
    lastDaysKeys.forEach(key => loadedDataLimited[key] = loadedData[key]);

    try {
      let fm = FileManager.iCloud();
      let path = getFilePath(fm, suffix);
      fm.writeString(path, JSON.stringify(loadedDataLimited))
      console.log('iCloud: save');
    } catch (e) {
      let fm = FileManager.local();
      let path = getFilePath(fm, suffix);
      fm.writeString(path, JSON.stringify(loadedDataLimited))
      console.log('Local: save');
    }

    return loadedData;
  }

  return {};
}

function loadData(suffix) {
  try {
    const fm = FileManager.iCloud();
    const path = getFilePath(fm, suffix);
  
    if (fm.fileExists(path)) {
      const data = fm.readString(path);
      console.log('iCloud: read');
      return JSON.parse(data);
    }
  } catch (e) {
    const fm = FileManager.local();
    const path = getFilePath(fm, suffix);
  
    if (fm.fileExists(path)) {
      const data = fm.readString(path);
      console.log('Local: read');
      return JSON.parse(data);
    }
  }

  return {};
}

function getFilePath(fm, suffix) {
  return fm.joinPath(fm.documentsDirectory(), `its-beds-${suffix}.json`)
}