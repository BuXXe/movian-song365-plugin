/**
 * Movian plugin to listen to song365.org streams 
 *
 * Copyright (C) 2016-2017 BuXXe
 *
 *     This file is part of song365.org Movian plugin.
 *
 *  song365.org Movian plugin is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  song365.org Movian plugin is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with song365.org Movian plugin.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  Download from : https://github.com/BuXXe/movian-song365-plugin
 *
 */
   var html = require('showtime/html');

(function(plugin) {

	// TODO: when / if possible use html parser instead of regex for the <em> tag problem
	// TODO: favorites : do not allow double entries -> right now: its the users responsibility
	// TODO: playlists (with custom user names (fail-proof names only) 
	// -> Problem: how to create a selection menu for existing playlists?
	// -> Favorites should be enough for now

	// TODO: Clean up ! 
	
	// INFO: Directory entries have no icon but video entries have options to "play until end of list" etc.
	//  -> to avoid wrong behavior, all entries are directories except the ones linking to direct mp3s
	//  -> this means: no logos / pics in search alburms / artists
	
	
	// Create / Get the storage for playlists / favorites etc.
	var store = plugin.createStore('personalStorage', true)
	
	// check / create stores for favorites / playlists
	// Playlists: have a unique name and list of tracks
	if (!store.playlists) {
        store.playlists = "[]";
    }
	// Favorite Albums / Artists / Tracks  
	if (!store.favorites) {
        store.favorites = "{\"albums\":[],\"artists\":[],\"tracks\":[]}";
    }

	var PLUGIN_PREFIX = "song365.org:";
  
  // Search param indicates the search criteria: Artist, Album, Track
  plugin.addURI(PLUGIN_PREFIX+"Search:(.*)", function(page, SearchParam) {
	  page.type="directory";
	  page.metadata.title = "Search for " + SearchParam;
	    
	  var res = showtime.textDialog("What "+ SearchParam + " do you want to search for?", true,true);
	  
	  // check for user abort
	  if(res.rejected)
		  page.redirect(PLUGIN_PREFIX+"SearchMenu");
	  else
	  {
		  var SearchQueryResponse = showtime.httpReq("https://www.yourmusics.net/search/"+SearchParam+"?keyword="+res.input,{
				  compression: true,
				  noFollow:true,
				  headers:{'User-Agent':'Mozilla/5.0 (Windows NT x.y; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0'}
				});

		  // Parse Search Results: Track -> Direct Play, Artist -> Artist Profile Page, Album -> Album Tracks
		  
		  // Problem: The search results are marked in <em> tags. The parsed dom structure makes it problematic
		  // to reconstruct the complete textContent. (the order of textContent and <em> tags children cant be reconstructed so far)
		  // Use one of these workarounds until a solution for this <em> tag problem is found.
		  // Workarounds:
		  // 1. Take other attributes like the img alt attribute etc to get the information (artist, title, album names)
		  // 	-> Is not really the best way to keep it easy / could result in wrong entries.
		  //	-> DUE TO SHORTER CODE, THIS SOLUTION IS TAKEN FOR ARTIST / ALBUM SEARCH
		  // 2. use Regex on the pure response object without parsing stuff
		  // 	-> could be performance problem 
		  //	-> THIS IS THE PRESENT SOLUTION FOR TRACK SEARCH

		  // this value indicates if there are search results or not.
		  var noEntry = true;
		  
		  // Display all Search results for tracks
		  if(SearchParam=="track")
		  {
				// get the names including <em> </em> tags
				// the song names and links can be taken from the same entry. we just need to take care about handling the array structure
				// link1, songname1, link2, songname2 ...
				var songreg = /<div class="song-name"><a href="(.*)" title=".*">(.*)<\/a><\/div>/gi;
				var artreg = /<div class="artist-name"><a href=".*" title=".*">(.*)<\/a><\/div>/gi;
				var albreg = /<div class="album-name"><a href=".*" title=".*">(.*)<\/a><\/div>/gi;
				
				var pos = 0;
				// needed for the params in the Optactions
				var tracks=[];
				var songnamesandlinks;
				while (songnamesandlinks = songreg.exec(SearchQueryResponse.toString())) {
					try{
						noEntry=false;
						var artistname = artreg.exec(SearchQueryResponse.toString())[1].replace(/(<\/em>|<em>)/g,"");
						var albumname = albreg.exec(SearchQueryResponse.toString())[1].replace(/(<\/em>|<em>)/g,"");
	
						var songname = songnamesandlinks[2].replace(/(<\/em>|<em>)/g,"");		
						var description = "Artist: "+artistname+"\n"+"Album: "+albumname+"\n"+"Track: "+songname;
						
						var item = page.appendItem(PLUGIN_PREFIX + 'DecodeSongAndPlay:'+songnamesandlinks[1], 'video', {
								  title: songname,
								  description: description,
								});
						
						tracks[pos]= {title: songname, description: description, link: songnamesandlinks[1] }
						item.addOptAction("Add track '" + songname + "' to favorites", pos);
					    item.onEvent(pos, function(item) 
					    		{
					    			var obj = showtime.JSONDecode(store.favorites);
					    			obj.tracks.push(tracks[item]);
					    			store.favorites = showtime.JSONEncode(obj);
					    		});
					    pos++;
			    	}catch(e)
			    	{
			    		showtime.trace("seems like there was a broken entry");
			    		showtime.trace(e.message);
			    		// seems like there was a broken entry
			    	}
				}
		  }
		  else if(SearchParam=="artist")
		  {  
			  	var dom = html.parse(SearchQueryResponse.toString());
				var entries =  dom.root.getElementByClassName('search-artist')[0].getElementByClassName('item');
			  	
			    for(var k=0; k< entries.length; k++)
			    {
			    	try{
			    		noEntry=false;
			    	
				    	var logo =  entries[k].getElementByTagName("img")[0].attributes.getNamedItem("src").value;
				    	var title =  entries[k].getElementByTagName("img")[0].attributes.getNamedItem("alt").value;
				    	var streamLink  = entries[k].getElementByTagName("a")[0].attributes.getNamedItem("href").value;
			    	
				    	var item = page.appendItem(PLUGIN_PREFIX + 'ArtistProfile:'+ streamLink, 'Directory', {
							  title: title, icon:logo
							});
				    	
				    	item.addOptAction("Add artist '" + title + "' to favorites", k);
				    	
					    item.onEvent(k, function(item) 
			    		{
			    	   		var entry = {
			    	   			title: entries[item].getElementByTagName("img")[0].attributes.getNamedItem("alt").value,
			    	   			icon: entries[item].getElementByTagName("img")[0].attributes.getNamedItem("src").value,
			    	   			link: entries[item].getElementByTagName("a")[0].attributes.getNamedItem("href").value
			    	   		};
			    	   		
			    	   		var obj = showtime.JSONDecode(store.favorites);
			    	   		obj.artists.push(entry);
			    	   		store.favorites = showtime.JSONEncode(obj);
			    		});
			    	}catch(e)
			    	{
			    		showtime.trace("seems like there was a broken entry");
			    		showtime.trace(e.message);
			    		// seems like there was a broken entry
			    	}
			    }
		  }
		  else if(SearchParam=="album")
		  {  
			  	var dom = html.parse(SearchQueryResponse.toString());
				var entries =  dom.root.getElementByClassName('search-album')[0].getElementByClassName('item');
				// workaround for the <em> tag problem
				var artreg = /<div class="artist-name"><a href=".*">(.*)<\/a><\/div>/gi;
				var artistnames = [];
				
				for(var k=0; k< entries.length; k++)
			    {
					try{
						noEntry=false;
					
						var title = entries[k].getElementByTagName("a")[0].getElementByTagName("img")[0].attributes.getNamedItem("alt").value;
				    	var streamLink  = entries[k].getElementByTagName("a")[0].attributes.getNamedItem("href").value;
				    	var logo = entries[k].getElementByTagName("a")[0].getElementByTagName("img")[0].attributes.getNamedItem("src").value;
				    	
				    	artistnames[k] = artreg.exec(SearchQueryResponse.toString())[1].replace(/(<\/em>|<em>)/g,"");
				    	
				    	var item = page.appendItem(PLUGIN_PREFIX + 'ArtistPageTracks:'+streamLink+":"+logo, 'Directory', {
							  title: title,
							  description: "Artist: "+artistnames[k],
							  icon: logo,
							});
	
				    	item.addOptAction("Add album '" + title + "' to favorites", k);
	
					    item.onEvent(k, function(item) 
			    		{
			    	   		var entry = {
			    	   			title: entries[item].getElementByTagName("a")[0].getElementByTagName("img")[0].attributes.getNamedItem("alt").value,
			    	   			icon: entries[item].getElementByTagName("a")[0].getElementByTagName("img")[0].attributes.getNamedItem("src").value,
			    	   			link: entries[item].getElementByTagName("a")[0].attributes.getNamedItem("href").value,
			    	   			artist: artistnames[item]
			    	   		};
			    	   		var obj = showtime.JSONDecode(store.favorites);
			    	   		obj.albums.push(entry);
			    	   		store.favorites = showtime.JSONEncode(obj);
			    		});
			    	}catch(e)
			    	{
			    		showtime.trace("seems like there was a broken entry");
			    		showtime.trace(e.message);
			    		// seems like there was a broken entry
			    	}
					
			    }
		  }
		  
		  if(noEntry == true)
			  page.appendPassiveItem('video', '', { title: 'The search gave no results' });
		  
		page.loading = false;
	  }
  });
  
  // Used to either display all tracks of an artist or the tracks of a specific album
  plugin.addURI(PLUGIN_PREFIX + 'ArtistPageTracks:(.*):(.*)', function(page, artistLink, backpic) {
	  	page.loading = false;
	  	page.type = 'directory';
	  	
	  	page.metadata.background = decodeURIComponent(backpic);
  	
	  	var finallink;
	  	// do we have an album?
	  	if(artistLink.indexOf("/album/") > -1)
	  		finallink = "https://www.yourmusics.net"+artistLink
  		else
		  	finallink = "https://www.yourmusics.net/artist/tracks/"+artistLink.split('/')[2];
  		
	  	var artistname;
	  	
	  	// 	albumname for full track listing not available!
	  	var albumname = "<no name found>";
	  	
	  	var BrowseResponse = showtime.httpReq(finallink,{
			  compression: true,
			  noFollow:true,
			  headers:{'User-Agent':'Mozilla/5.0 (Windows NT x.y; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0'}
			});
	  	var dom = html.parse(BrowseResponse.toString());
	  	
	  	// get the title for the page
	  	// either the contents of the album with name X or all tracks by artist X
	  	var pageTitle="Placeholder";
	  	
	  	// if its an album we have a profile with all info
	  	if(artistLink.indexOf("/album/") > -1)
	  	{
	  		// construct title with album name and artist name
	  		albumname = dom.root.getElementByClassName('page')[0].getElementByTagName("h1")[0].textContent;
	  		artistname = dom.root.getElementByClassName('profile')[0].getElementByTagName("a")[0].textContent;
	  		pageTitle = albumname +  " by "+ artistname;
	  	}
	  	else
	  	{
	  		pageTitle = dom.root.getElementByClassName('sub-title')[0].textContent;
	  		artistname = pageTitle.replace("Tracks by ","");
	  	}
	  	page.metadata.title = pageTitle;
	  	var tracks = [];
	  	var entries =  dom.root.getElementByClassName('artist-songs')[0].getElementByClassName("item");
	    for(var k=0; k< entries.length; k++)
	    {
	    	try
	    	{
	    		var title = entries[k].getElementByClassName("song-name")[0].getElementByTagName("a")[0].textContent;
	    	
		    	var TrackPlayLink  = entries[k].getElementByClassName("play")[0].attributes.getNamedItem("href").value;
		    	
		    	var description = "Artist: "+artistname+"\n"+"Album: "+albumname+"\n"+"Track: "+title;
		    	
		    	var item = page.appendItem(PLUGIN_PREFIX + 'DecodeSongAndPlay:'+TrackPlayLink, 'video', { title: title, description: description });
		    	
		    	
		    	tracks[k]= {title: title, description: description, link: TrackPlayLink };
		    	
				item.addOptAction("Add track '" + title + "' to favorites", k);
			    item.onEvent(k, function(item) 
			    		{
			    			var obj = showtime.JSONDecode(store.favorites);
			    			obj.tracks.push(tracks[item]);
			    			store.favorites = showtime.JSONEncode(obj);
			    		});
	    	}
	    	catch(e)
	    	{
	    		showtime.trace("seems like there was a broken entry");
	    		showtime.trace(e.message);
	    		// seems like there was a broken entry 
	    	}
	    }
		page.loading = false;
	});
 
  // Show all albums for a given artist
  plugin.addURI(PLUGIN_PREFIX + 'ArtistPageAlbums:(.*):(.*)', function(page,artistLink,profilepic) {
	  	page.loading = false;
	  	page.type = 'directory';
	  
	  	page.metadata.background = decodeURIComponent(profilepic);
	  	
	  	// construct link to artists album page
	  	var artilinkstrip = artistLink.split('/')[2];
	  	var finallink = "https://www.yourmusics.net/artist/albums/"+artilinkstrip;
	  	
	  	var BrowseResponse = showtime.httpReq(finallink,{
			  compression: true,
			  noFollow:true,
			  headers:{'User-Agent':'Mozilla/5.0 (Windows NT x.y; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0'}
			});
	  	var dom = html.parse(BrowseResponse.toString());
	  	
	  	// get the Artist name from the page
	  	var artistname = dom.root.getElementByClassName('sub-title')[0].textContent;
	  	page.metadata.title = artistname;
	  	
	  	var albumlist =  dom.root.getElementByClassName('artist-album')[0];
	  	var entries = albumlist.getElementByClassName("item");
	  	
	    for(var k=0; k< entries.length; k++)
	    {
	    	try
	    	{
		    	// get albums picture + title + link
		    	var title= entries[k].getElementByClassName("album-name")[0].getElementByTagName("a")[0].textContent;
		    	var albumLink  = entries[k].getElementByTagName("a")[0].attributes.getNamedItem("href").value;
		    	var logo = entries[k].getElementByTagName("a")[0].getElementByTagName("img")[0].attributes.getNamedItem("src").value;
		    	
		    	var item = page.appendItem(PLUGIN_PREFIX + 'ArtistPageTracks:'+albumLink+":"+encodeURIComponent(logo), 'Directory', {
					  title: title,
					  icon: logo,
					});
		    	
		    	item.addOptAction("Add album '" + title + "' to favorites", k);
	
			    item.onEvent(k, function(item) 
	    		{
	    	   		var entry = {
	    	   			title: entries[item].getElementByClassName("album-name")[0].getElementByTagName("a")[0].textContent,
	    	   			icon: entries[item].getElementByTagName("a")[0].getElementByTagName("img")[0].attributes.getNamedItem("src").value,
	    	   			link: entries[item].getElementByTagName("a")[0].attributes.getNamedItem("href").value,
	    	   			artist: artistname
	    	   		};
	    	   		var obj = showtime.JSONDecode(store.favorites);
	    	   		obj.albums.push(entry);
	    	   		store.favorites = showtime.JSONEncode(obj);
	    		});
	    	}
	    	catch(e)
	    	{
	    		showtime.trace("seems like there was a broken entry");
	    		showtime.trace(e.message);
	    		// seems like there was a broken entry
	    	}
	    	
	    }
		page.loading = false;
	});
  
  // Handles the artist profile to access all albums / all tracks
  plugin.addURI(PLUGIN_PREFIX + 'ArtistProfile:(.*)', function(page, artistLink) {
	  	page.loading = false;
	  	page.type = 'directory';
	  	
	  	// get background photo
	  	var BrowseResponse = showtime.httpReq("https://www.yourmusics.net"+artistLink,{
			  compression: true,
			  noFollow:true,
			  headers:{'User-Agent':'Mozilla/5.0 (Windows NT x.y; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0'}
			});
	  	var dom = html.parse(BrowseResponse.toString());
	  	
	  	// get title from page: the first h1 under the div with class "page"   
	  	page.metadata.title = dom.root.getElementByClassName('page')[0].getElementByTagName("h1")[0].textContent;
	  	
	  	var link = dom.root.getElementByClassName('photo')[0].children[0].attributes.getNamedItem("src").value;
	  	page.metadata.background = link;

	  	page.appendItem(PLUGIN_PREFIX + 'ArtistPageTracks:'+artistLink+":"+encodeURIComponent(link), 'Directory', { title: "All Tracks" });
		page.appendItem(PLUGIN_PREFIX + 'ArtistPageAlbums:'+artistLink+":"+encodeURIComponent(link), 'Directory', { title: "All Albums" });

		page.loading = false;
	});
  
  // Retrieves the direct link to the mp3 file and plays it. 
  plugin.addURI(PLUGIN_PREFIX + 'DecodeSongAndPlay:(.*)', function(page, streamLink) {
	  	page.loading = false;
	  	
	    var BrowseResponse = showtime.httpReq("https://www.yourmusics.net"+streamLink,{
			  compression: true,
			  noFollow:true,
			  headers:{'User-Agent':'Mozilla/5.0 (Windows NT x.y; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0'}
			});	
	  	page.source = /var url = '(.*)';/g.exec(BrowseResponse.toString())[1];
		page.type = 'video';
		page.loading = false;
	});
  
  // Construct the Browse space
  // Link to specific Letter entry:
  // https://www.song365.org/artist-digital.html or [a-z].html
  plugin.addURI(PLUGIN_PREFIX + 'BrowsebyArtist', function(page) {
	  	page.type = "directory";
	    page.metadata.title = "Browse artists starting with:";
	    	
	    page.appendItem(PLUGIN_PREFIX + 'BrowsebyArtistStartingWith:'+ 'digital', 'Directory', { title: '#' });
	    for(var k=0; k< 26; k++)
	    {
	    	var letter = String.fromCharCode(97+k);
	    	page.appendItem(PLUGIN_PREFIX + 'BrowsebyArtistStartingWith:'+ letter, 'Directory', { title: letter.toUpperCase()});
	    }
  });

  // Shows a list of all Artists starting with given letter
  // Link to specific Letter entry:
  // https://www.song365.org/artist-digital.html or [a-z].html
  plugin.addURI(PLUGIN_PREFIX + 'BrowsebyArtistStartingWith:(.*)', function(page,letter) {
  	page.type = "directory";
    page.metadata.title = "Browse artists starting with: "+letter.toUpperCase();
    
    // Get List of artists
    var BrowseResponse = showtime.httpReq("https://www.yourmusics.net/artist-"+letter+".html",{
		  compression: true,
		  noFollow:true,
		  headers:{'User-Agent':'Mozilla/5.0 (Windows NT x.y; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0'}
		});
  	var dom = html.parse(BrowseResponse.toString());

  	
  	var entries =  dom.root.getElementByClassName('list')[0].getElementByTagName("a");
  	var titles = [];
    for(var k=0; k< entries.length; k++)
    {
    	try{
    		
	    	// the first hot items are in "em" tags. to get their title we need to identify them
	    	var title = "<No Title Found>";
	    	if( entries[k].textContent == undefined)
	    		title = entries[k].children[1].textContent;
	    	else
	    		title = entries[k].textContent;
	    	
	    	// get artist site link
	    	var ArtistProfileLink  = entries[k].attributes.getNamedItem("href").value;
	    	var item = page.appendItem(PLUGIN_PREFIX + 'ArtistProfile:'+ ArtistProfileLink, 'Directory', { title: title });
	    	
	    	titles[k] = title;
	    	item.addOptAction("Add artist '" + title + "' to favorites", k);
	    	
		    item.onEvent(k, function(item) 
			{
		    	// TODO: There are no icon links here 
		    	// although it would be a long solution we 
		    	// could take it from artist profile by a separate post 
		    	// -> as long as we have the directory entries we dont need icons
		   		var entry = {
		   			title: titles[item],
		   			icon: "",
		   			link:  entries[item].attributes.getNamedItem("href").value
		   		};
		   		
		   		var obj = showtime.JSONDecode(store.favorites);
		   		obj.artists.push(entry);
		   		store.favorites = showtime.JSONEncode(obj);
			});
    	}catch(e)
    	{
    		showtime.trace("seems like there was a broken entry");
    		showtime.trace(e.message);
    		// seems like there was a broken entry
    		
    	}
    }
  });
  
  
  // Displays the favorites menu to choose which favorites to view
  plugin.addURI(PLUGIN_PREFIX + 'Favorites', function(page) {
	  	page.type = "directory";
	    page.metadata.title = "Which favorites to browse:";
	    	
	    page.appendItem(PLUGIN_PREFIX + 'DisplayFavorites:'+ 'artists', 'Directory', { title: 'Favorite artists' });
	    page.appendItem(PLUGIN_PREFIX + 'DisplayFavorites:'+ 'albums', 'Directory', { title: 'Favorite albums'});
	    page.appendItem(PLUGIN_PREFIX + 'DisplayFavorites:'+ 'tracks', 'Directory', { title: 'Favorite tracks'});
  });
  
  // Displays the favorite artists / albums / tracks
  plugin.addURI(PLUGIN_PREFIX + 'DisplayFavorites:(.*)', function(page, category) {
	  	page.type = "directory";
	    page.metadata.title = "Favorite "+category;
	    	
	    var list = showtime.JSONDecode(store.favorites)[category];
        if (!list || !list.toString()) {
           page.error("Favorites list is empty");
           return;
        }

        
        for (var i in list) {
		    		   
		    		    
		    var item;
		    if(category == "tracks")
		    {
		    	item = page.appendItem(PLUGIN_PREFIX + 'DecodeSongAndPlay:'+list[i].link, 'video', {
					  title: list[i].title,
					  description: list[i].description,
					});
		    }
		    else if(category == "albums")
		    {
		    	item = page.appendItem(PLUGIN_PREFIX + 'ArtistPageTracks:'+list[i].link+":"+list[i].icon, 'Directory', {
					  title: list[i].title,
					  icon: list[i].icon,
					  description: "Artist: "+ list[i].artist
					});
		    }
		    else if(category == "artists")
		    {
		    	item = page.appendItem(PLUGIN_PREFIX + 'ArtistProfile:'+ list[i].link, 'Directory', {
					  title: list[i].title,
					  icon: list[i].icon,
					});
		    }
		    
		    item.addOptAction("Remove '" + list[i].title + "' from My Favorites", i);
		    
		    item.onEvent(i, function(item) 
		    		{
		    			var obj = showtime.JSONDecode(store.favorites);
		    	   		obj[category].splice(item, 1);
		    	   		store.favorites = showtime.JSONEncode(obj);
		    			page.flush();
		    			page.redirect(PLUGIN_PREFIX + 'DisplayFavorites:'+category);
		    		});
            
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
    page.appendItem(PLUGIN_PREFIX + 'Favorites','directory',{title: "Favorites" });
    page.appendItem(PLUGIN_PREFIX + 'SearchMenu','item',{title: "Search..." });
	page.loading = false;
  });

  //Register a service (will appear on home page)
  var service = plugin.createService("song365.org", PLUGIN_PREFIX+"start", "music", true, plugin.path + "song365.png");
  
})(this);
    