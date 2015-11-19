/**
 * Showtime plugin to listen to song365.org streams 
 *
 * Copyright (C) 2015 BuXXe
 *
 *     This file is part of song365.org Showtime plugin.
 *
 *  song365.org Showtime plugin is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  song365.org Showtime plugin is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with kinox.to Showtime plugin.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  Download from : NOT YET AVAILABLE
 *
 */
   var html = require('showtime/html');

(function(plugin) {

	// TODO: Workaround of the em tag problem
	// TODO: titles / names with colons (:) in it result in resolver errors due to wrong regex matches for the pages
	// TODO: Clean things up!
	
	
  var PLUGIN_PREFIX = "song365.org:";
   
  
  
  // Search param indicates the search criteria: Artist, Album, Track
  plugin.addURI(PLUGIN_PREFIX+"Search:(.*)",function(page,SearchParam) {
	  page.type="directory";
	  page.metadata.title = "Search for "+SearchParam;
	    
	  var res = showtime.textDialog("What "+SearchParam+ " do you want to search for?", true,true);
	  
	  // check for user abort
	  if(res.rejected)
		  page.redirect(PLUGIN_PREFIX+"SearchMenu");
	  else
	  {
		  var SearchQueryResponse = showtime.httpGet("https://www.song365.org/search/"+SearchParam+"?keyword="+res.input);
		  
		  // Parse Search Result
		  // Track -> Direct Play
		  // Artist -> Artist Profile Page
		  // Album -> Album Tracks
		  
		  // TODO: Outsource to common function
		  
		  // Display all Search Results for Tracks
		  // TODO: need to use description for artist name and album
		  if(SearchParam=="track")
		  {
				var dom = html.parse(SearchQueryResponse.toString());
				var songlist =  dom.root.getElementByClassName('search-songs')[0];
				var entries = songlist.getElementByClassName("item");
				
				
				
				// titles may be problematic due to <em> tags in the titles (due to search)
				// workaround: use the title of the anchor
				// TODO improve this workaround
				// Idea: use regex global replace instead of simple replace to replace all em tags in the response string
				// http://stackoverflow.com/questions/1967119/why-does-javascript-replace-only-first-instance-when-using-replace
				// date.replace(new RegExp("/", "g"), '')
				// or
				// date.replace(/\//g, '')
				
				for(var k=0; k< entries.length; k++)
				{
					// give artist and album name
					var artistname = entries[k].getElementByClassName("artist-name")[0].getElementByTagName("a")[0].attributes.getNamedItem("title").value; 
					var albumname = entries[k].getElementByClassName("album-name")[0].getElementByTagName("a")[0].attributes.getNamedItem("title").value;
						
					var description = "Artist: "+artistname+"\n"+"Album: "+albumname;
					
					// the title contains artist + track name
					// this can be hard to read so we need to remove the artist name
					// trying this by using artistname and replace first occurance in title
					var title= entries[k].getElementByClassName("song-name")[0].getElementByTagName("a")[0].attributes.getNamedItem("title").value;
					title = title.replace(artistname+" ","");
					// get track play link
					var streamLink  = entries[k].getElementByClassName("play")[0].attributes.getNamedItem("href").value;
					
					page.appendItem(PLUGIN_PREFIX + 'DecodeSongAndPlay:'+streamLink, 'video', {
							  title: title,
							  description: description,

							});
				}
		  }
		  else if(SearchParam=="artist")
		  {  
			  	var dom = html.parse(SearchQueryResponse.toString());
				var artistlist =  dom.root.getElementByClassName('search-artist')[0];
				var entries =  artistlist.getElementByClassName('item');
			  	
			    for(var k=0; k< entries.length; k++)
			    {
			    	// the artist name gets <em> tags where the search fits. 
			    	// to get the name we use the alt attribute from the image
			    	// TODO: improve this workaround 
			    	
			    	var logo =  entries[k].getElementByTagName("img")[0].attributes.getNamedItem("src").value;
			    	
			    	var title =  entries[k].getElementByTagName("img")[0].attributes.getNamedItem("alt").value;
			    	
			    	// get artist site link
			    	var streamLink  = entries[k].getElementByTagName("a")[0].attributes.getNamedItem("href").value;
		    	
			    	page.appendItem(PLUGIN_PREFIX + 'ArtistProfile:'+title+':'+ streamLink, 'video', {
						  title: title,
						  icon:logo,
						});
			    }
		  }
		  else if(SearchParam=="album")
		  {  
			  	var dom = html.parse(SearchQueryResponse.toString());
				var artistlist =  dom.root.getElementByClassName('search-album')[0];
				var entries =  artistlist.getElementByClassName('item');
				
				
				for(var k=0; k< entries.length; k++)
			    {
			    	// get albums picture + title + link
			    	// album title needs to be taken from logo alternative as the search adds <em> tags which are hard to be taken care of
					// TODO improve this workaround
			    	//var title= entries[k].getElementByClassName("album-name")[0].getElementByTagName("a")[0].textContent;
					var title = entries[k].getElementByTagName("a")[0].getElementByTagName("img")[0].attributes.getNamedItem("alt").value;
			    	
			    	// get album link
			    	var streamLink  = entries[k].getElementByTagName("a")[0].attributes.getNamedItem("href").value;
			    	var logo = entries[k].getElementByTagName("a")[0].getElementByTagName("img")[0].attributes.getNamedItem("src").value;
			    	
			    	page.appendItem(PLUGIN_PREFIX + 'ArtistPageTracks:'+title+":"+streamLink+":"+logo, 'video', {
						  title: title,
						  icon: logo,
						});
			    }
		  }
		page.loading = false;
	  }
  });

  
  // Used to either display all tracks of an artist or the tracks of a specific album
  plugin.addURI(PLUGIN_PREFIX + 'ArtistPageTracks:(.*):(.*):(.*)', function(page, title, artistLink, backpic) {
	  	page.loading = false;
	  	page.type = 'directory';
	  	page.metadata.title = title;
	  	page.metadata.background = backpic;
  	
	  	var finallink;
	  	// do we have an album?
	  	if(artistLink.indexOf("/album/") > -1)
	  		finallink = "https://www.song365.org"+artistLink
  		else
		  	finallink = "https://www.song365.org/artist/tracks/"+artistLink.split('/')[2];
  		
	  	var BrowseResponse = showtime.httpGet(finallink);
	  	var dom = html.parse(BrowseResponse.toString());
	  	var entries =  dom.root.getElementByClassName('artist-songs')[0].getElementByClassName("item");
	    for(var k=0; k< entries.length; k++)
	    {
	    	var title = entries[k].getElementByClassName("song-name")[0].getElementByTagName("a")[0].textContent;
	    	var TrackPlayLink  = entries[k].getElementByClassName("play")[0].attributes.getNamedItem("href").value;
	
	    	page.appendItem(PLUGIN_PREFIX + 'DecodeSongAndPlay:'+TrackPlayLink, 'video', { title: title });
	    }
		page.loading = false;
	});
 
  // Show all albums for a given artist
  plugin.addURI(PLUGIN_PREFIX + 'ArtistPageAlbums:(.*):(.*):(.*)', function(page, title,artistLink,profilepic) {
	  	page.loading = false;
	  	page.type = 'directory';
	  	page.metadata.title = title;
	  	page.metadata.background = profilepic;
	  	
	  	// construct link to artists album page
	  	var artilinkstrip = artistLink.split('/')[2];
	  	var finallink = "https://www.song365.org/artist/albums/"+artilinkstrip;
	  	var BrowseResponse = showtime.httpGet(finallink);
	  	var dom = html.parse(BrowseResponse.toString());
	  	
	  	var albumlist =  dom.root.getElementByClassName('artist-album')[0];
	  	var entries = albumlist.getElementByClassName("item");
	  	
	    for(var k=0; k< entries.length; k++)
	    {
	    	// get albums picture + title + link
	    	var title= entries[k].getElementByClassName("album-name")[0].getElementByTagName("a")[0].textContent;
	    	var albumLink  = entries[k].getElementByTagName("a")[0].attributes.getNamedItem("href").value;
	    	var logo = entries[k].getElementByTagName("a")[0].getElementByTagName("img")[0].attributes.getNamedItem("src").value;
	    	
	    	page.appendItem(PLUGIN_PREFIX + 'ArtistPageTracks:'+title+":"+albumLink+":"+logo, 'video', {
				  title: title,
				  icon: logo,
				});
	    }
		page.loading = false;
	});
  
  // Handles the artist profile to access all albums / all tracks
  plugin.addURI(PLUGIN_PREFIX + 'ArtistProfile:(.*):(.*)', function(page, title,artistLink) {
	  	page.loading = false;
	  	page.type = 'directory';
	  	page.metadata.title = title;
	  	
	  	// get background photo
	  	var BrowseResponse = showtime.httpGet("https://www.song365.org"+artistLink);
	  	var dom = html.parse(BrowseResponse.toString());
	  	var link = dom.root.getElementByClassName('photo')[0].children[0].attributes.getNamedItem("src").value;
	  	page.metadata.background = link;

	  	page.appendItem(PLUGIN_PREFIX + 'ArtistPageTracks:'+title+":"+artistLink+":"+link, 'video', { title: "All Tracks" });
		page.appendItem(PLUGIN_PREFIX + 'ArtistPageAlbums:'+title+":"+artistLink+":"+link, 'video', { title: "All Albums" });

		page.loading = false;
	});
  
  // Retrieves the direct link to the mp3 file and plays it. 
  plugin.addURI(PLUGIN_PREFIX + 'DecodeSongAndPlay:(.*)', function(page, streamLink) {
	  	page.loading = false;

	  	var BrowseResponse = showtime.httpGet("https://www.song365.org"+streamLink);
	  	var result = BrowseResponse.toString().match(/var url = '(.*)';/g);
	  	// TODO: somehow the regex does not give the match group so we need to do a substring to get link
	  	var mp3 = result[0].substring(11,result[0].length-2);
	  	
	  	page.source = mp3;
		page.type = 'video';
		page.loading = false;
	});
  
  // Construct the Browse space
  // Link to specific Letter entry:
  // https://www.song365.org/artist-digital.html or [a-z].html
  plugin.addURI(PLUGIN_PREFIX + 'BrowsebyArtist', function(page) {
	  	page.type = "directory";
	    page.metadata.title = "Browse artists starting with:";
	    	
	    page.appendItem(PLUGIN_PREFIX + 'BrowsebyArtistStartingWith:'+ 'digital', 'video', { title: '#' });
	    for(var k=0; k< 26; k++)
	    {
	    	var letter = String.fromCharCode(97+k);
	    	page.appendItem(PLUGIN_PREFIX + 'BrowsebyArtistStartingWith:'+ letter, 'video', { title: letter.toUpperCase()});
	    }
  });

  // Shows a list of all Artists starting with given letter
  // Link to specific Letter entry:
  // https://www.song365.org/artist-digital.html or [a-z].html
  plugin.addURI(PLUGIN_PREFIX + 'BrowsebyArtistStartingWith:(.*)', function(page,letter) {
  	page.type = "directory";
    page.metadata.title = "Browse artists starting with: "+letter.toUpperCase();
    
    // Get List of artists
    var BrowseResponse = showtime.httpGet("https://www.song365.org/artist-"+letter+".html");
  	var dom = html.parse(BrowseResponse.toString());
  	var entries =  dom.root.getElementByClassName('list')[0].getElementByTagName("a");
  	
    for(var k=0; k< entries.length; k++)
    {
    	// the first hot items are in "em" tags. to get their title we need to identify them
    	var title = "<No Title Found>";
    	if( entries[k].textContent == undefined)
    		title = entries[k].children[1].textContent;
    	else
    		title = entries[k].textContent;
    	
    	// get artist site link
    	var ArtistProfileLink  = entries[k].attributes.getNamedItem("href").value;
    	page.appendItem(PLUGIN_PREFIX + 'ArtistProfile:'+title+':'+ ArtistProfileLink, 'video', { title: title });
    }
  });
  
  // Gives a Search Menu with 3 different Search-Entries: Artist, Album and Track Search
  plugin.addURI(PLUGIN_PREFIX+"SearchMenu", function(page) {
    page.type = "directory";
    page.metadata.title = "song365.org Search Menu";

    // different search params for artist, album, track
    page.appendItem(PLUGIN_PREFIX + 'Search:artist', 'directory',{ title: "Search for Artist" });
    page.appendItem(PLUGIN_PREFIX + 'Search:album', 'directory',{ title: "Search for Album"	});
    page.appendItem(PLUGIN_PREFIX + 'Search:track','directory',{ title: "Search for Track" });
	page.loading = false;
  });
  
  // Register Start Page
  // Main Menu: Browse all artists alphabetically / Search Menu
  plugin.addURI(PLUGIN_PREFIX+"start", function(page) {
    page.type = "directory";
    page.metadata.title = "song365.org Main Menu";
    page.appendItem(PLUGIN_PREFIX + 'BrowsebyArtist', 'directory',{title: "Browse by Artist" });
    page.appendItem(PLUGIN_PREFIX + 'SearchMenu','item',{title: "Search..." });
	page.loading = false;
  });

  //Register a service (will appear on home page)
  var service = plugin.createService("song365.org", PLUGIN_PREFIX+"start", "music", true, plugin.path + "song365.png");
  
})(this);
    