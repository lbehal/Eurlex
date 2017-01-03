// ==UserScript==
// @name         Eurlex
// @namespace    eu_01
// @version      0.4
// @require      https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js
// @require      https://raw.githubusercontent.com/lbehal/Eurlex/master/tooltipster.bundle.min.js
// @resource     tooltipster_css https://raw.githubusercontent.com/lbehal/Eurlex/master/tooltipster.bundle.min.css
// @require      https://cdn.jsdelivr.net/clipboard.js/1.5.16/clipboard.min.js
// @resource     tooltipster_css2 https://raw.githubusercontent.com/lbehal/Eurlex/master/tooltipster-sideTip-shadow.min.css
// @require      https://raw.githubusercontent.com/lbehal/Eurlex/master/tooltipster-scrollableTip.min.js
// @description  Adds celex numbers to links to OJ with page numbers..
// @author       Ladislav Behal
// @match        http://eur-lex.europa.eu/legal-content/*
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest 
// ==/UserScript==

(function() {
    'use strict';
	var cm_CssSrc = GM_getResourceText("tooltipster_css");
    GM_addStyle (cm_CssSrc);
	var cm_CssSrc2 = GM_getResourceText("tooltipster_css2");
    GM_addStyle (cm_CssSrc2);
    
    //$1 = this.jQuery = jQuery.noConflict(true);
    console.log('2');
    var idMatch = new RegExp("^ntc.*?-E....$");
	var linkMatch = new RegExp(",[\\s\\u00A0]+[sp](?:\\.)?[\\s\\u00A0]+(\\d+)[\\s\\u00A0]*$");
	
	var ojUriMatch = new RegExp("uri=OJ\\:(.*?)\\:(.*?)\\:(.*?)\\:TOC");//uri=OJ:L:2006:302:TOC
    var noteLinks = [];
	var clipboard = new Clipboard('.btn');
	
	function escapeRegExp(str) {
		return str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
	}
	
	function sparqlQuery(sparqlQuery, onLoad)
	{
		var queryParams = 
				{
					query : sparqlQuery,
					format: "application/sparql-results+json",
					timeout: "0",
					debug: "off"
				};
			var enchodedParams = $.param(queryParams);
			var url = `http://publications.europa.eu/webapi/rdf/sparql?${enchodedParams}`;
			//query sparql endpoint for the celex
			GM_xmlhttpRequest({
				method: "GET",
				url: url,
				headers: {
					"User-Agent": "Mozilla/5.0",  
					"Accept": "application/json, text/javascript, */*; q=0.01"
				},
				onload: function(response) {
					try {							
						var result = JSON.parse(response.responseText);
						if(result.results === null || result.results.bindings.length === 0) return;
						onLoad(result.results.bindings);						
					}
					catch(err) {
						console.log(err);
						debugger;
					}					
				}
			});	
	}
	
	//add celex buttons to all OJ links 
	$("a").each(function() {		
		var el = $(this);
		var linkText = el.text().replace(/\u00a0/g, " ");
		var href = el.attr('href');
		var textOk = linkMatch.test(linkText);
		if(ojUriMatch.test(href) && textOk === true)
		{
			var match = ojUriMatch.exec(href);
			var oj = match[1];
			var year = match[2];
			var num = match[3];
			var pn = linkMatch.exec(linkText)[1];

			var pageNum = ('0000'+pn).slice(-4);
			
			var s_query = `prefix cdm: <http://publications.europa.eu/ontology/cdm#> select distinct ?celex where 
					{
					  ?oj  cdm:official-journal_number '${num}'^^xsd:positiveInteger.
					  ?oj cdm:publication_general_date_publication ?dp.
					  BIND(YEAR(xsd:datetime(?dp)) as ?year)
					  filter(?year = ${year})
					  ?oj  cdm:official-journal_part_of_collection_document <http://publications.europa.eu/resource/authority/document-collection/OJ-${oj}>.
					  ?w cdm:resource_legal_id_celex ?celex.
					  ?w cdm:resource_legal_published_in_official-journal ?oj.  
					  ?e cdm:expression_belongs_to_work ?w.
					  ?m cdm:manifestation_manifests_expression ?e.
					  ?m cdm:manifestation_official-journal_part_page_first '${pageNum}'^^xsd:string.
					}
					`;
			
			sparqlQuery(s_query, function(bindings){
				var celex = bindings[0].celex.value;
				var celexMsg = celex+" zkopírován do schránky";
				if(typeof celex === undefined) return;
				console.log(celex);

				//create button with celexid and set it up for clipboard copy..					
				var celexEls = $(`<button class="btn" style="margin-left:5px" data-clipboard-text="${celex}">${celex}</button>`);				
				celexEls.insertAfter(el);

				var noteEl = el.parent("p.note");	
				if(noteEl !== null)
				{
					var noteLink = noteEl.children('a:first-child');
					var noteLinkId = noteLink.attr('id');
					$(`a[href='#${noteLinkId}']`).each(function() 
													   {
						//this is a reference of changed notelink.
						//we will update tooltipster value for all these since tooltipster does copy the html on init.
						//var instance = $(this).tooltipster('instance');
						//instance.content(noteEl);
						$(this).tooltipster('content', noteEl);

					});
				}
			});										
		}
	});
	
	//add tooltip to all notereference links
    $("a").each(function() {
     if(idMatch.test(this.id))//this is correct link.
     {	
		
         $(this).addClass("tooltips"); //mark this with tooltip class so we can show a tooltip with tooltipster plugin
         var hrefid = escapeRegExp($(this).attr('href'));
         $(this).attr('data-tooltip-content', "p.note:has(a"+hrefid+")");
		 
		 
         var noteId = this.id.substring(this.id.length-5);
         console.log(noteId);
         noteLinks.push({element:this, noteId : noteId});
     }   
    });
  
    $('.tooltips').tooltipster({
        plugins: ['sideTip', 'scrollableTip'],
		theme: 'tooltipster-shadow',
        contentCloning: true,
        trigger: 'custom',
		interactive: true,
        triggerOpen: {
            mouseenter: true
        },
        triggerClose: {
            click: true,
            scroll: true
        }
    });
    //if we have sth to link
    if(noteLinks.length > 0)
    {
      //we must get the xml since the html does not contain the Page attribute
    }
	
	var eclis = [];	
	$("div#text").find("*").each(function() {
		var regex = new RegExp("ECLI\\:(.*?)\\:(.*?)\\:(.*?)\\:(\\w+)");
		
		$(this).contents().filter(function() {
				if(this.nodeType != 3) return false;
				var ismatch= regex.test(this.nodeValue);					
				if(ismatch) console.log(this.nodeValue);				
				return  ismatch;
			}).each(function() {
			var match = regex.exec(this.nodeValue);
			eclis.push({ecli:match[0], textNode: this , match:match, processed:false, celex:""});
			
		});
	});
	
	if(eclis.length > 0)
	{
		debugger;
		var eclivals = "";
		eclis.forEach(function(currentValue, index, arr){
			if(eclivals.length > 0) eclivals+= " , ";
			eclivals+=`'${currentValue.ecli}'^^xsd:string`;			
		});
		
		var es_query = `prefix cdm: <http://publications.europa.eu/ontology/cdm#> select distinct ?celex, ?ecli where 
                        {
                            ?e rdfs:subPropertyOf cdm:ecli.
                            ?s ?e ?ecli.
                            filter(?ecli IN (${eclivals}))
                            ?s cdm:resource_legal_id_celex ?celex.
                        }`;
		sparqlQuery(es_query, function(bindings){
			
                //assign all found celexes
				bindings.forEach(function(currentValue, index, arr){
					console.log(currentValue);
					var celex = currentValue.celex.value;
					var ecli = currentValue.ecli.value;
					
					//get textnode with ecli.					
					//replace it with 
					//create button with celexid and set it up for clipboard copy..							
					var ecliObject = eclis.filter(function( obj ) {
						return obj.ecli == ecli;
					});	
					
					ecliObject.forEach(function(currentValue, index, arr){	
						currentValue.celex = celex;
					});					
				});
			debugger;
			//go throug all eclis with celex			
			eclis.filter(function(obj){
				return obj.celex.length > 0;
			}).forEach(function(currentValue, index, arr){	
				if(currentValue.processed === true) return;
				//now are there other eclis with the same textNode? 
				var sameTextnodes = eclis.filter(function( obj ) {
					return obj.textNode === currentValue.textNode;
				}).sort(function(a, b) {
					if (a.match.index <  b.mabtch.index) 
						return -1;
					if (a.match.index >  b.mabtch.indexn)
						return 1;
					return 0;
				});		

				sameTextnodes.forEach(function(currentValue, index, arr){
					//now contruct new element.
					var curNode = currentValue.textNode;
					var replacementNode = curNode.splitText(currentValue.match.index + currentValue.match[0].length);						

					// adding the span before the text after found ECLI
					var celexEls = $(`<button class="btn" style="margin-left:5px" data-clipboard-text="${currentValue.celex}">${currentValue.celex}</button>`);
					//curNode.parentNode.insertBefore(celexEls, replacementNode);
					celexEls.insertBefore($(replacementNode));
					
					currentValue.processed = true;
				});

					/*celexEls.insertAfter(el);

					var noteEl = el.parent("p.note");	
					if(noteEl !== null)
					{
						var noteLink = noteEl.children('a:first-child');
						var noteLinkId = noteLink.attr('id');
						$(`a[href='#${noteLinkId}']`).each(function() 
														   {
							//this is a reference of changed notelink.
							//we will update tooltipster value for all these since tooltipster does copy the html on init.
							//var instance = $(this).tooltipster('instance');
							//instance.content(noteEl);
							$(this).tooltipster('content', noteEl);

						});
					}*/
			});
		});
	}
					
})();
