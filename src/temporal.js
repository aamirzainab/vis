// Import statements
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import {updateIntervals, getGlobalState, dragged} from "./script.js"
let x;
let intervalWidth;
let intervals;
var bins = 5;
let numberOfUsers = 2;

const colorScale = d3.scaleOrdinal()
	.domain([0, 1, 2])
	.range(["#1b9e77", "#d95f02", "#7570b3"]);


// function changeBinSize(newBinSize) {
// 	var event = new CustomEvent('binSizeChange', {
// 		detail: newBinSize
// 	});
// 	updateIntervals(newBinSize);
// 	window.dispatchEvent(event);
// }

// document.getElementById('binsDropdown').addEventListener('change', function() {
// 	bins = parseInt(this.value);
// 	changeBinSize(this.value);
// 	loadAndPlotTemporal();
// });



export async function loadAndPlotTemporal() {
  try {
      const data = await d3.json("topic_oriented_analysis_full_data.json");
      // const preparedData = prepareDataForPlotting(data);

      createSharedAxis(data);
  } catch (error) {
      console.error("Error loading or processing the JSON data", error);
  }
}

function prepareDataForPlotting(data) {
	data.sort((a, b) => a.parsedStartTime - b.parsedStartTime);
	return data;
}

export function animateTemporalView(currentTimestamp) {
	const svg = d3.select("#temporal-view");
	if (!svg.empty()) {
		const allRects = svg.selectAll("rect:not(.title-rect)").style("opacity", 0.2);
		const allTexts = svg.selectAll("text:not(.title-text)").style("opacity", 0.2);

		allRects.each(function(d, i) {
			if (d !== undefined) {
				const start = d.intervalStart.getTime();
				const end = d.intervalEnd.getTime();
				if (currentTimestamp >= start && currentTimestamp < end) {

					d3.select(this).style("opacity", 1);
					d3.select(allTexts.nodes()[i]).style("opacity", 1);
				}
			}
		});
		const interactionSvg = d3.select("#interaction-plot-container svg");
		if (!interactionSvg.empty()) {
			const interactionRects = interactionSvg.selectAll("rect:not(.title-rect)").style("opacity", 0.2);
			const interactionTexts = interactionSvg.selectAll("text:not(.title-text)").style("opacity", 0.2);
			const opacityState = {};
			interactionRects.each(function(d, i) {
				if (d != undefined) {
					const roundedTimestamp = Math.round(currentTimestamp);
					const start = d.intervalStart.getTime();
					const end = d.intervalEnd.getTime();
					let diff1 = currentTimestamp - start;
					diff1 = Math.abs((diff1 % 1000) / 10);
					let diff2 = end - currentTimestamp;
					diff2 = Math.abs((diff2 % 1000) / 10);
					if (currentTimestamp >= start && currentTimestamp < end) {
						d3.select(this).style("opacity", 1);
						d3.select(allTexts.nodes()[i]).style("opacity", 1);
					}
				}
			});
		}
		animateGroupedInteractions(currentTimestamp);
    // createLine(currentTimestamp);
    const globalState = getGlobalState();
    const range =  Math.abs(globalState.lineTimeStamp2 - globalState.lineTimeStamp1);
    // createLines(currentTimestamp, currentTimestamp + range );
	}
}

function animateGroupedInteractions(currentTimeStamp) {
	const interactionSvg = d3.select("#interaction-plot-container svg");
	if (!interactionSvg.empty()) {
		const allInteractionRects = interactionSvg.selectAll("rect.interaction-rect");
		allInteractionRects.each(function(d, i) {
			if (d != undefined) {
				const start = d.intervalStart.getTime();
				const end = d.intervalEnd.getTime();
				if (currentTimeStamp >= start && currentTimeStamp < end) {
					d3.select(this).style("opacity", 1);
					// d3.select(allTexts.nodes()[i]).style("opacity", 1);
				}
			}
		});
	}

}

export function getXScale() {
	return x;
}