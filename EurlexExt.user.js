// ==UserScript==
// @name         Eurlex
// @namespace    eu_01
// @version      0.3
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
			
			var sparqlQuery = `prefix cdm: <http://publications.europa.eu/ontology/cdm#> select distinct ?celex where 
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
						if(result.results === null || result.results.bindings.length === 0 || result.results.bindings["0"].celex === undefined) return;
						console.log(result);
						var celex = result.results.bindings["0"].celex.value;
						var celexMsg = celex+" zkopírován do schránky";
						if(typeof celex === undefined) return;
						console.log(celex);
						
						//create button with celexid and set it up for clipboard copy..					
						var celexEls = $(`<button class="btn" style="margin-left:5px" data-clipboard-text="${celex}">${celex}</button>`);
						
						
						//noteEl.append(celexEls);
						celexEls.insertAfter(el);
						
						debugger;
						var noteEl = el.parent("p.note");	
						if(noteEl !== null)
						{
							var noteLink = noteEl.children('a:first-child');
							var noteLinkId = noteLink.attr('id');
							$(`a[href='#${noteLinkId}']`).each(function() 
															   {
								//this is a reference of changed notelink.
								//we will update tooltipster value for all these since tooltipster does copy the html on init.

								var instance = $(this).tooltipster();
								//instance.content(noteEl);
								$(this).tooltipster('content', noteEl);

							});
						}
					}
					catch(err) {
						console.log(err);
						debugger;
					}
					
				}
			});		
		}
	});
	
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
	
    
})();
