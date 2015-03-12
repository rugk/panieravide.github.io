/*
 * This file is part of OpenLevelUp!.
 * 
 * OpenLevelUp! is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * any later version.
 * 
 * OpenLevelUp! is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with OpenLevelUp!.  If not, see <http://www.gnu.org/licenses/>.
 */

/*
 * OpenLevelUp!
 * Web viewer for indoor mapping (based on OpenStreetMap data).
 * Author: Adrien PAVIE
 *
 * Controller JS class
 */

OLvlUp.controller = {
// ====== CONSTANTS ====== 
/** Overpass API server URL **/
API_URL: "http://www.overpass-api.de/api/interpreter?data=",


// ======= CLASSES =======
/**
 * Application controller (as defined in MVC pattern).
 * Updates view and model depending of user actions in view.
 */
Ctrl: function() {
//ATTRIBUTES
	/** The current MapData object **/
	var _mapdata = null;
	
	/** The current HTML view **/
	var _view;
	
	/** The previous level value (before a map update) **/
	var _oldLevel;
	
	/** Should we use level parameter from URL ? **/
	var _useLevelURL = true;
	
	/** The current object **/
	var _self = this;
	
//ACCESSORS
	/**
	 * @return The current view
	 */
	this.getView = function() {
		return _view;
	}
	
	/**
	 * @return The current map data object
	 */
	this.getMapData = function() {
		return _mapdata;
	}
	
//OTHER METHODS
	/**
	 * This function initializes the controller
	 */
	this.init = function() {
		_view = new OLvlUp.view.Web(_self);
		
		//Init leaflet map
		_view.mapInit();
		
		//Create mapdata object
		_mapdata = new OLvlUp.model.MapData(_self);
		
		_self.onMapUpdate();
	}
	
	/**
	 * Increases the level value
	 */
	this.levelUp = function() {
		_view.levelUp(_mapdata);
	}
	
	/**
	 * Decreases the level value
	 */
	this.levelDown = function() {
		_view.levelDown(_mapdata);
	}
	
	/**
	 * This function is called when a minor change on map happens (transcendent change, base layer change, ...)
	 */
	this.onMapChange = function() {
		_view.refreshMap(_mapdata);
	}
	
	/**
	 * This function is called when map should display legacy objects (or not)
	 */
	this.onMapLegacyChange = function() {
		//If in data zooms, only change shown objects
		if(_view.getMap().getZoom() >= OLvlUp.view.DATA_MIN_ZOOM) {
			_view.refreshMap(_mapdata);
		}
		//If in cluster zooms, re-download data
		else if(_view.getMap().getZoom() >= OLvlUp.view.CLUSTER_MIN_ZOOM) {
			_self.onMapUpdate(true);
		}
	}
	
	/**
	 * This function is called when map was moved or zoomed in/out.
	 * @param force Force data download (optional, default: false)
	 */
	this.onMapUpdate = function(force) {
		force = force || false;

		//Clear messages
		_view.clearMessages();
		
		//Recreate mapdata if null
		if(_mapdata == null) {
			_mapdata = new OLvlUp.model.MapData(_self);
		}
		
		//Check if zoom is high enough to download data
		if(_view.getMap().getZoom() >= OLvlUp.view.CLUSTER_MIN_ZOOM) {
			_view.setLoading(true);
			
			//High zoom data download
			if(_view.getMap().getZoom() >= OLvlUp.view.DATA_MIN_ZOOM) {
				_oldLevel = _view.getCurrentLevel();
				
				//Download data only if new BBox isn't contained in previous one
				if(force || _mapdata.getBBox() == null || !_mapdata.getBBox().contains(_view.getMap().getBounds())) {
					//Download data
					_mapdata.cleanData();
					_self.downloadData("data", _mapdata.handleOapiResponse);
					//When download is done, endMapUpdate() will be called.
				}
				//Else, we just update view
				else {
					_self.endMapUpdate();
				}
			}
			//Low zoom data download (cluster)
			else {
				//Download data only if new BBox isn't contained in previous one
				if(force
					|| _mapdata.isClusterLegacy() != _view.showLegacy()
					|| _mapdata.getClusterBBox() == null
					|| !_mapdata.getClusterBBox().contains(_view.getMap().getBounds())) {

					//Download data
					_mapdata.cleanClusterData();
					_mapdata.setClusterLegacy(_view.showLegacy());
					_self.downloadData("cluster", _mapdata.handleOapiClusterResponse);
					//When download is done, endMapClusterUpdate() will be called.
				}
				//Else, we just update view
				else {
					_self.endMapClusterUpdate();
				}
			}
		}
		//Else, clean map
		else {
			_view.populateSelectLevels({});
			_view.displayMessage("Zoom in to see more information", "info");
			_view.refreshMap(_mapdata);
		}
	}
	
	/**
	 * This function is called after data download finishes
	 */
	this.endMapUpdate = function() {
		if(_mapdata.getLevels() != null) {
			_view.populateSelectLevels(_mapdata.getLevels());
			
			//Test how many levels are available
			if(_mapdata.getLevels() != null && _mapdata.getLevels().length > 0) {
				//If we have to use the level parameter from the URL
				var levelUrl = parseFloat(_view.getUrlParameter("level"));
				if(_useLevelURL && _mapdata.getLevels().indexOf(levelUrl) >= 0) {
					_view.setCurrentLevel(levelUrl);
				}
				_useLevelURL = false;
				
				//Restore old level if possible
				if(!_useLevelURL && _mapdata.getLevels().indexOf(_oldLevel) >=0) {
					_view.setCurrentLevel(_oldLevel);
				}
			}
			//If no available level, display some message
			else {
				_view.displayMessage("There is no available data in this area", "alert");
			}
			
			//Refresh leaflet map
			_view.refreshMap(_mapdata);
		}
		_view.setLoading(false);
	}
	
	/**
	 * This function is called after cluster data download finishes
	 */
	this.endMapClusterUpdate = function() {
		_view.populateSelectLevels({});
		
		//Update view
		_view.refreshMap(_mapdata);
		_view.setLoading(false);
	}
	
	/**
	 * This function is called when user wants to export the currently shown level
	 */
	this.onExportLevel = function() {
		if(_view.getCurrentLevel() != null && _view.getDataLayer() != null) {
			var data = new Blob(
				[JSON.stringify(_view.getDataLayer().toGeoJSON(), null, '\t')],
				{ type: "application/json;charset=tf-8;" }
			);
			saveAs(data, "level_"+_view.getCurrentLevel()+".geojson");
		}
		else {
			_view.displayMessage("No level available for export", "alert");
		}
	}
	
	/**
	 * This function is called when user wants to export the currently shown level as an image
	 */
	this.onExportLevelImage = function() {
		//TODO
	}
	
	/**
	 * Downloads data from Overpass API
	 * Then calls another function to process it.
	 * @param type The kind of request ("data" or "cluster")
	 * @param handler The handler function, which will process the data
	 */
	this.downloadData = function(type, handler) {
		var bounds = _view.getMapBounds();
		var oapiRequest = null;
		
		//Prepare request depending of type
		if(type == "cluster") {
			_mapdata.setClusterBBox(_view.getMap().getBounds());
			oapiRequest = '[out:json][timeout:25];(way["indoor"]["indoor"!="yes"]["level"]('+bounds+');';
			if(_view.showLegacy()) { oapiRequest += 'way["buildingpart"]["level"]('+bounds+');'; }
			oapiRequest += ');out body center;';
		}
		else {
			_mapdata.setBBox(_view.getMap().getBounds());
			oapiRequest = '[out:json][timeout:25];(node["door"]('+bounds+');<;>;node["entrance"]('+bounds+');<;>;node["level"]('+bounds+');way["level"]('+bounds+');relation["type"="multipolygon"]["level"]('+bounds+');node["repeat_on"]('+bounds+');way["repeat_on"]('+bounds+');way["min_level"]('+bounds+');way["max_level"]('+bounds+');relation["type"="level"]('+bounds+'));out body;>;out skel qt;';
		}

		//Download data
		var oapiResponse = $.get(OLvlUp.controller.API_URL+encodeURIComponent(oapiRequest), handler, "text");
	}
}

};