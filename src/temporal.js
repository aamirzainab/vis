// Import statements
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import {
    updateIntervals
} from "./script.js"
import {
    dragged
} from "./script.js"
// import nest from

let x;
let intervalWidth;
let intervals;
var bins = 5;
let numUsers = 2;

const colorScale = d3.scaleOrdinal()
  .domain([0,1,2])
  .range(["#1b9e77", "#d95f02", "#7570b3"]);


function changeBinSize(newBinSize) {
    // Create and dispatch a custom event with the new bin size
    var event = new CustomEvent('binSizeChange', {
        detail: newBinSize
    });
    updateIntervals(newBinSize);
    window.dispatchEvent(event);
}

document.getElementById('binsDropdown').addEventListener('change', function() {
    bins = parseInt(this.value);
    changeBinSize(this.value);
    loadAndPlotTemporal();
});



export async function loadAndPlotTemporal() {
    try {
        const userFiles = [{
                textsFile: "file1Texts.json",
                interactionsFile: "file1Interactions.json",
                userId: "User1"
            },
            {
                textsFile: "file1TextsNew.json",
                interactionsFile: "file1InteractionsNew.json",
                userId: "User2"
            }
            // Add more user files and IDs as needed
        ];

        let combinedDataSpeech = [];
        let combinedDataInteraction = [];
        for (const {
                textsFile,
                interactionsFile,
                userId
            }
            of userFiles) {
            // Load and process text data
            const dataTexts = await d3.json(textsFile);
            const parsedDataTexts = dataTexts.map(d => ({
                ...d,
                UserId: userId,
                parsedStartTime: new Date(d.StartTime),
                parsedEndTime: new Date(d.EndTime)
            }));
            combinedDataSpeech = combinedDataSpeech.concat(parsedDataTexts);

            // Load and process interaction data
            const dataInteractions = await d3.json(interactionsFile);
            const parsedDataInteractions = dataInteractions.map(d => ({
                ...d,
                UserId: userId,
                parsedStartTime: new Date(d.StartTime),
                parsedEndTime: new Date(d.EndTime)
            }));
            combinedDataInteraction = combinedDataInteraction.concat(parsedDataInteractions);
        }

        // Proceed with data preparation and plotting
        const preparedDataSpeech = prepareDataForPlotting(combinedDataSpeech);
        const preparedDataInteraction = prepareDataForPlotting(combinedDataInteraction);
        let allCombinedData = [...combinedDataSpeech, ...combinedDataInteraction];
        createSharedAxis(allCombinedData);
        const aggregatedDataInteraction = aggregateDataIntervalInteraction(preparedDataInteraction, intervals);
        const aggregatedDataSpeech = aggregateDataIntervalSpeech(preparedDataSpeech, intervals);
        aggregatedDataSpeech.pop();

        createPlotAggregatedInteractions(aggregatedDataInteraction);
        createPlotAggregatedSpeech(aggregatedDataSpeech);
        const startingPointLine = x(intervals[0]) + 5;
        createLine(startingPointLine);
        // createPlotSpeech(preparedData);
        // createPlotInteraction(preparedDataTemp);
        const simpleDataSpeech = aggregateSpeechData(preparedDataSpeech);
        // plotOneBarchart(simpleDataSpeech);
        // plotThreeLineplot();
        const simpleDataInteractions = aggregateXRInteractions(preparedDataInteraction);
        // plotFourSpiderChart(simpleDataSpeech, simpleDataInteractions);

    } catch (error) {
        console.error("Error loading or processing the JSON data", error);
    }
}


function createSharedAxis(data) {
    const temporalViewContainer = d3.select("#temporal-view");
    const sharedAxisContainer = temporalViewContainer.select("#shared-axis-container");
    sharedAxisContainer.html("");
    const margin = {
      top: 20,
      right: 30,
      bottom: 10,
      left: 40
  };
    const scaling = 50;
    // const width = document.getElementById('spatial-view').clientWidth - margin.left - margin.right ;
    // const width = document.getElementById('spatial-view').clientWidth + document.getElementById('right-pane').clientWidth ;
    const width = window.innerWidth;
    const startTime = d3.min(data, d => d.parsedStartTime);
    const somePadding = 0;
    const endTime = new Date(d3.max(data, d => d.parsedEndTime).getTime() + somePadding);
    const totalTime = endTime - startTime; // in milliseconds
    const intervalDuration = totalTime / bins;
    intervals = Array.from({
        length: bins + 1
    }, (v, i) => new Date(startTime.getTime() + i * intervalDuration));
    const widthh = width - margin.right - margin.left;

    intervalWidth = (totalTime) / bins;
    // console.log("this is end time from tmeporal.ks " + new Date(endTime));
    x = d3.scaleTime()
        .domain([
            d3.min(data, d => d.parsedStartTime),
            endTime
        ])
        .range([0, widthh]);

    const axisHeight = 30;
    const xAxis = d3.axisTop(x)
        .tickValues(intervals) // Set custom tick values
        .tickFormat(d3.timeFormat("%H:%M:%S"))
        .tickPadding(5);

    const svg = sharedAxisContainer.append("svg")
        .attr("width", width)
        .attr("height", margin.top + margin.bottom + axisHeight)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const axisGroup = svg.append("g")
        .attr("transform", `translate(0,${margin.top - 15})`)
        .attr("class", "x-axis")
        .call(xAxis)
        .selectAll("text")
        .style("font-size", "12px")
        .style("fill", "#666");

}

function aggregateDataIntervalInteraction(data, intervals) {
    const countsPerInterval = intervals.map(interval => ({
        User1: {
            count: {},
            events: []
        },
        User2: {
            count: {},
            events: []
        },
        intervalStart: interval,
        intervalEnd: new Date(interval.getTime() + (intervals[1].getTime() - intervals[0].getTime()))
    }));
    // console.log(countsPerInterval);

    data.forEach(d => {
        const user = d.UserId;
        const startTime = new Date(d.parsedStartTime); // Ensuring this is a Date object
        const endTime = new Date(d.parsedEndTime);
        // console.log(`Processing: ${user}, Time: ${startTime}`);
        // console.log("user id " + user );

        for (let i = 0; i < intervals.length - 1; i++) {
            // console.log(`Checking interval: ${intervals[i]} to ${intervals[i + 1]}`);
            if (startTime >= intervals[i] && startTime < intervals[i + 1]) {
                // console.log(`Matched interval for ${user} at ${startTime}`);
                const message = d.Message;
                // Assuming correction here for accessing the 'count' object
                if (!countsPerInterval[i][user].count[message]) {
                    countsPerInterval[i][user].count[message] = 1;
                } else {
                    countsPerInterval[i][user].count[message] += 1;
                }
                // console.log(`Pushing event for ${user}:`, { message: message, timestamp: startTime });
                countsPerInterval[i][user].events.push({
                    message: message,
                    eventStartTimeStamp: startTime,
                    eventEndTimeStamp: endTime
                });
                // Pushing event
                // countsPerInterval[i][user].events.push({
                //     message: message,
                //     timestamp: startTime // Using ISO string for consistency
                // });
            }
        }
    });

    // countsPerInterval.forEach((interval, index) => {
    //   console.log(`Interval ${index + 1}:`);go
    //   console.log(`Start: ${interval.intervalStart}, End: ${interval.intervalEnd}`);

    //   console.log('User1:');
    //   console.log('Count:', interval.User1.count);
    //   console.log('Events:');
    //   interval.User1.events.forEach((event, eventIndex) => {
    //     console.log(`  Event ${eventIndex + 1}: ${event.message} at ${event.timestamp}`);
    //   });

    //   console.log('User2:');
    //   console.log('Count:', interval.User2.count);
    //   console.log('Events:');
    //   interval.User2.events.forEach((event, eventIndex) => {
    //     console.log(`  Event ${eventIndex + 1}: ${event.message} at ${event.timestamp}`);
    //   });

    //   console.log('---------------------------');
    // });
    return countsPerInterval;
}



function aggregateSpeechData(data) {
  let aggregatedData = {};

  data.forEach(d => {
      const userId = d.UserId;
      const startTime = new Date(d.StartTime);
      const endTime = new Date(d.EndTime);
      const duration = endTime - startTime;
      const wordCount = d.TranscriptionText.split(' ').length;
      if (!aggregatedData[userId]) {
          aggregatedData[userId] = {
              events: []
          };
      }

      // Push event data into user's events array
      aggregatedData[userId].events.push({
          transcriptionText: d.TranscriptionText,
          startTime: startTime,
          endTime: endTime,
          duration: duration,
          wordCount: wordCount
      });
  });

  return aggregatedData;
}

function aggregateXRInteractions(data) {
  let aggregatedData = {};

  data.forEach(d => {
    const userId = d.UserId;
    const interactionType = d.Message; // Assuming 'Message' indicates interaction type
    // Initialize user data structure if not already present
    if (!aggregatedData[userId]) {
      aggregatedData[userId] = { xrInteractions: {} };
    }
    // Count interactions by type
    if (!aggregatedData[userId].xrInteractions[interactionType]) {
      aggregatedData[userId].xrInteractions[interactionType] = 1;
    } else {
      aggregatedData[userId].xrInteractions[interactionType] += 1;
    }
  });

  return aggregatedData;
}

function aggregateDataIntervalSpeech(data, intervals) {
    const dataPerInterval = intervals.map(interval => ({
        intervalStart: interval,
        intervalEnd: new Date(interval.getTime() + (intervals[1].getTime() - intervals[0].getTime())),
        User1: {
            events: []
        }, // Initialize events array for User1
        User2: {
            events: []
        } // Initialize events array for User2
    }));

    data.forEach(d => {
        const user = d.UserId;
        const startTime = new Date(d.StartTime);
        const endTime = new Date(d.EndTime);

        for (let i = 0; i < dataPerInterval.length; i++) {
            if (startTime >= dataPerInterval[i].intervalStart && startTime < dataPerInterval[i].intervalEnd) {
                const transcriptionText = d.TranscriptionText;
                // Push event to the respective user's events array
                dataPerInterval[i][user].events.push({
                    transcriptionText: transcriptionText,
                    eventStartTimeStamp: startTime,
                    eventEndTimeStamp: endTime,
                    duration: endTime - startTime,
                    wordCount: transcriptionText.split(' ').length, 

                });
                break; // Exit loop once the interval is found
            }
        }
    });
    //  dataPerInterval.forEach((interval, index) => {
    //   console.log(`Interval ${index + 1}:`);
    //   console.log(`Start: ${interval.intervalStart}, End: ${interval.intervalEnd}`);

    //   console.log('User2:');
    //   console.log('Count:', interval.User2.count);
    //   console.log('Events:');
    //   interval.User2.events.forEach((event, eventIndex) => {
    //     console.log(`  Event ${eventIndex + 1}: saying this  ${event.transcriptionText} starting at this time  ${event.eventStartTimeStamp}
    //     with word count   ${event.wordCount} and duration ${event.duration}`);
    //   });

    //   console.log('---------------------------');
    // });

    return dataPerInterval;
}




function createPlotAggregatedSpeech(aggregatedData) {
    const temporalViewContainer = d3.select("#temporal-view");
    const plotContainer = d3.select("#speech-plot-container");
    plotContainer.html("");
    const spatialViewWidth = document.getElementById('spatial-view').clientWidth;
    const temporalViewHeight = document.getElementById('temporal-view').clientHeight;
    // const margin = { top: 30, right: 40, bottom: 10, left: 40 };
    // const margin = {
    //     top: 0,
    //     right: 40,
    //     bottom: 0,
    //     left: 40
    // };
    const margin = {
      top: 20,
      right: 30,
      bottom: 10,
      left: 40
  };
    // const width = spatialViewWidth - margin.left - margin.right;
    const width = window.innerWidth;
    // const width = document.getElementById('spatial-view').clientWidth + document.getElementById('right-pane').clientWidth - margin.left - margin.right ;
    
    const height = temporalViewHeight/2 - margin.top - margin.bottom;
    const svg = plotContainer.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const barHeight = 30;

    aggregatedData.forEach((intervalData, intervalIndex) => {
        ['User1', 'User2'].forEach((user, userIndex) => {
            const barWidth = x(intervalData.intervalEnd) - x(intervalData.intervalStart);
            if (intervalData[user] && intervalData[user].events && intervalData[user].events.length > 0) {
                // Then, check if any of these events have non-empty transcription text
                const hasNonEmptyTranscriptionText = intervalData[user].events.some(event => event.transcriptionText.trim() !== '');

                if (hasNonEmptyTranscriptionText) {
                    // if (intervalData[user].some(event => event.transcriptionText.trim() !== '')) {
                    let yPos;
                    let color;
                    if (userIndex === 0) {
                        yPos = (height / 2) - barHeight - 5;
                    } else {
                        yPos = (height / 2);
                    }
                    color = colorScale(user);
                    const xPos = x(intervalData.intervalStart);
                    svg.append("rect")
                        .attr("class", `speech-rect user-${userIndex}`)
                        .data([{
                            ...intervalData,
                            userIndex
                        }])
                        // .data([{parsedStartTime: intervalData.intervalStart, parsedEndTime: intervalData.intervalEnd}])
                        // .attr("x", x(intervalData.intervalStart))
                        .attr("x", xPos)
                        .attr("y", yPos)
                        .attr("width", barWidth)
                        .attr("height", barHeight) // Use fixed bar height
                        .attr("fill", color);
                    // .attr("stroke", "black")
                    // .attr("stroke-width", 2);
                    const textYPos = yPos + barHeight / 2;

                    svg.append("text")
                        .attr("x", x(intervalData.intervalStart) + barWidth / 2)
                        // .style("text-anchor", "middle")
                        .attr("y", textYPos)
                        // .text(intervalData[user].events.map(event => `${event.transcriptionText}`))
                        // .text(intervalData[user].map(([message, count]) => `${message} (${count})`).join(", "))
                        // .text("SPEECH")
                        .attr("fill", "contrastColor") // Ensure text color is visible
                        .style("font-size", "10px")
                        .attr("dominant-baseline", "middle"); // Center text vertically within the bar
                }
            }
        });
    });

    const text = "VERBAL COMMUNICATION";
    const textHeight = 200;
    const textWidth = 60;
    const rectX = -height / 2 - textHeight / 2;
    const rectY = -margin.left - textWidth / 2;
    const rectWidth = textWidth;
    const rectHeight = textHeight;

    svg.append("rect")
        .attr("class", "title-rect")
        .attr("x", rectX)
        .attr("y", rectY)
        .attr("width", rectHeight)
        .attr("height", rectWidth)
        .attr("transform", "rotate(-90)")
        .style("fill", "lightblue");
    svg.append("text")
        .attr("class", "title-text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .attr("dominant-baseline", "middle")
        .style("text-anchor", "middle")
        .style("font-size", "9.5")
        .text(text);
    d3.select("#speech-plot-container").on("click", function(event) {
        var clickedElement = d3.select(event.target);
        if (clickedElement.node().tagName === "rect") {
            var rectData = clickedElement.data();
            plotMagnifiedDataSpeech(rectData);
        }
    });
}


function createPlotAggregatedInteractions(aggregatedData) {
    const temporalViewContainer = d3.select("#temporal-view");
    const plotContainer = d3.select("#interaction-plot-container");
    plotContainer.html("");
    const spatialViewWidth = document.getElementById('spatial-view').clientWidth;
    const temporalViewHeight = document.getElementById('temporal-view').clientHeight;
    // const margin = { top: 20, right: 40, bottom: 30, left: 30 };
    // const margin = {
    //     top: 0,
    //     right: 40,
    //     bottom: 0,
    //     left: 40
    // };
    const margin = {
      top: 20,
      right: 30,
      bottom: 10,
      left: 40
  };
    const height =  temporalViewHeight - margin.top - margin.bottom;
    const fixedHeight = 100; // Example fixed height
    // console.log("this is fixed height" + fixedHeight);
    // const width = spatialViewWidth - margin.left - margin.right;
    const width = window.innerWidth;
    const barHeight = 30 ;
    let maxInteractions = 0;
    const activeIntervals = aggregatedData.filter(intervalData => {
        const totalInteractions = ['User1', 'User2'].reduce((acc, user) => {
            const userCounts = intervalData[user].count;
            const userTotal = Object.values(userCounts).reduce((sum, count) => sum + count, 0);
            return acc + userTotal;
        }, 0);
        return totalInteractions > 0;
    });
    activeIntervals.forEach(intervalData => {
        ['User1', 'User2'].forEach(user => {
            const interactions = Object.values(intervalData[user].count).reduce((sum, count) => sum + count, 0);
            maxInteractions = Math.max(maxInteractions, interactions);
        });
    });

    const svg = plotContainer.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", fixedHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    const localColorScale = d3.scaleOrdinal()
    .domain(["User1", "User2"])
    .range(["#80cbc4", "#ffcc80"]);

    activeIntervals.forEach((intervalData, intervalIndex) => {
        ['User1', 'User2'].forEach((user, userIndex) => {
            const barWidth = x(intervalData.intervalEnd) - x(intervalData.intervalStart);
            const xPos = x(intervalData.intervalStart) - 2;
            let totalInteractionsPerInterval = Object.values(intervalData[user].count).reduce((sum, count) => sum + count, 0);
            let messageTexts = Object.entries(intervalData[user].count)
                .map(([message, count]) => `${message} (${count})`)
                .join(", ");
            if (messageTexts !== "") {
                let yPos;
                let color;
                if (userIndex === 0) {
                    yPos = (fixedHeight / 2) - barHeight - 5;
                    color = d3.interpolateRgb(localColorScale(user), colorScale(userIndex))(totalInteractionsPerInterval / maxInteractions);

                } else {
                    yPos = (fixedHeight / 2) + 5; // Adjust spacing and position as needed
                    color = d3.interpolateRgb(localColorScale(user), colorScale(userIndex))(totalInteractionsPerInterval / maxInteractions);
                }

                svg.append("rect")
                    .attr("class", `interaction-rect user-${userIndex}`)
                    // .data([intervalData])
                    .data([{
                        ...intervalData,
                        userIndex
                    }])
                    .attr("x", xPos)
                    .attr("y", yPos)
                    .attr("width", barWidth)
                    .attr("height", barHeight)
                    .attr("fill", color);
                const textYPos = yPos + barHeight / 2;
                const textXPos = 10;

                // svg.append("text")
                //     .attr("x", x(intervalData.intervalStart) + textXPos)
                //     .attr("y", textYPos)
                //     // .text(intervalData[user].map(([message, count]) => `${message} (${count})`).join(", "))
                //     .text(messageTexts)
                //     .attr("fill", "contrastColor") // Ensure text color is visible
                //     .style("font-size", "10px")
                //     // .style("text-anchor", "middle")
                //     .attr("dominant-baseline", "middle"); // Center text vertically within the bar
            }
        });
    });
    const text = "XR INTERACTION";
    // const padding = 10;
    const textHeight = 100;
    const textWidth = 60;
    const rectX = -fixedHeight / 2 - textHeight / 2;
    const rectY = -margin.left - textWidth / 2;
    const rectWidth = textWidth;
    const rectHeight = textHeight;
    svg.append("rect")
        .attr("class", "title-rect")
        .attr("x", rectX)
        .attr("y", rectY) // Slightly adjust the rectangle's position
        .attr("width", rectHeight) // Width and height are swapped due to rotation, with a little extra for padding
        .attr("height", rectWidth)
        .attr("transform", "rotate(-90)")
        .style("fill", "lightgreen");
    svg.append("text")
        .attr("class", "title-text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (fixedHeight / 2))
        .attr("dy", "1em")
        .attr("dominant-baseline", "middle")
        .style("text-anchor", "middle")
        .style("font-size", "9.5")
        .text(text);
    d3.select("#interaction-plot-container").on("click", function(event) {
        var clickedElement = d3.select(event.target);
        if (clickedElement.node().tagName === "rect") {
            var rectData = clickedElement.data();
            plotMagnifiedDataInteraction(rectData);
        }
    });

}

function plotMagnifiedDataSpeech(rectData) {
    const userIndex = rectData[0].userIndex;
    const userIDString = "User" + (userIndex + 1);
    const userEvents = rectData[0][userIDString].events;

    // const color =
    let allEvents = [];
    userEvents.forEach(event => {
        allEvents.push(new Date(event.eventStartTimeStamp).getTime());
        allEvents.push(new Date(event.eventEndTimeStamp).getTime());
    });

    let earliestTimestamp = new Date(Math.min(...allEvents));
    let latestTimestamp = new Date(Math.max(...allEvents));
    // if (latestTimestamp - earliestTimestamp < 1000) { // Less than 1 second difference
    if (latestTimestamp === earliestTimestamp) {
        console.log("here");
        earliestTimestamp = new Date(earliestTimestamp.setSeconds(0, 0));
        latestTimestamp = new Date(earliestTimestamp);
        latestTimestamp = new Date(latestTimestamp.setSeconds(59, 0));
    }
    const plotBox2 = d3.select("#plot-box2").html("");
    const margin = {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
    };
    const width = plotBox2.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 100; // Fixed height for simplicity
    const rectHeight = 20; // Height of rectangles
    const offset = 10;
    const rectYPosition = margin.top + 20;


    const svg = d3.select("#plot-box2").html("") // Clear any existing content
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const timeRange = latestTimestamp - earliestTimestamp;
    // console.log(timeRange);
    const stepSize = timeRange / 4;

    const tickValues = [earliestTimestamp];
    for (let i = 1; i <= 3; i++) {
        tickValues.push(new Date(earliestTimestamp.getTime() + stepSize * i));
    }

    tickValues.push(latestTimestamp);

    const xScale = d3.scaleTime()
        .domain([earliestTimestamp, latestTimestamp])
        .range([0, width]);


    const timeFormat = d3.timeFormat("%M:%S");

    const xAxis = d3.axisTop(xScale)
        .tickValues(tickValues)
        .tickFormat(timeFormat)
        .tickPadding(5);
    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${margin.top})`)
        .call(xAxis)
        .selectAll("text")
        // .selectAll("text")
        // .style("font-size", "10px");
        .style("font-size", "12px") // Increase font size
        .style("fill", "#666") // Change font color
    // .style("text-anchor", "end") // Anchor text to the end
    // .attr("dx", "-.8em") // Position adjustments
    // .attr("dy", ".15em"); // Position adjustments
    // .attr("transform", "rotate(-65)"); // Rotate the text for slanted labels

    //   svg.selectAll(".x-axis path, .x-axis line")
    // .style("stroke", "#333") // Change the color of the axis line and ticks
    // .style("shape-rendering", "crispEdges"); // Ensures that lines are drawn sharply


    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background-color", "white")
        .style("max-width", "300px")
        .style("border", "1px solid #777")
        .style("border-radius", "5px")
        .style("padding", "10px")
        .style("font-size", "14px")
        .style("opacity", 0)
        .style("z-index", "1000")
        .style("white-space", "normal");

    userEvents.forEach(dataEvent => {
        const startTime = new Date(dataEvent.eventStartTimeStamp).getTime();
        const endTime = new Date(dataEvent.eventEndTimeStamp).getTime();
        const eventTime = new Date(dataEvent.eventStartTimeStamp).getTime();
        let duration = endTime - startTime;
        svg.append("rect")
            .attr("x", xScale(new Date(startTime)))
            .attr("width", xScale(new Date(startTime + duration)) - xScale(new Date(startTime)))
            .attr("y", rectYPosition)
            .attr("height", rectHeight)
            .attr('stroke', 'black')
            .attr('stroke-width', '1')
            .attr("fill", colorScale(userIDString))
            .on("mouseover", function(event) {
                const svgRect = svg.node().getBoundingClientRect();
                const [tooltipX, tooltipY] = [event.pageX, event.pageY];
                console.log(dataEvent.transcriptionText);
                tooltip.html(dataEvent.transcriptionText)
                .style("opacity", 1)
                .style("visibility", "hidden"); // Make tooltip invisible but still take up space for measurement
                const tooltipWidth = tooltip.node().getBoundingClientRect().width;
                const tooltipHeight = tooltip.node().getBoundingClientRect().height;
                const padding = 20; // Add some padding from the window edges
                let adjustedX = tooltipX + padding;
                let adjustedY = tooltipY + padding;
            
                // Adjust X position if tooltip goes beyond the right edge of the window
                if (tooltipX + tooltipWidth + padding > window.innerWidth) {
                    adjustedX = window.innerWidth - tooltipWidth - padding;
                }
            
                // Adjust Y position if tooltip goes beyond the bottom edge of the window
                if (tooltipY + tooltipHeight + padding > window.innerHeight) {
                    adjustedY = window.innerHeight - tooltipHeight - padding;
                }
            
                // Update tooltip position with adjustments
                tooltip.style("left", adjustedX + "px")
                    .style("top", adjustedY + "px")
                    .style("visibility", "visible"); // Make tooltip visible again
                // tooltip.html(dataEvent.transcriptionText)
                //     .style("opacity", 1)
                //     .style("left", tooltipX + "px")
                //     .style("top", tooltipY + "px");
            })
            .on("mouseout", function() {
                tooltip.style("opacity", 0);
            });

    });
}

function plotMagnifiedDataInteraction(rectData) {
    // Extract user index from the rectData
    const userIndex = rectData[0].userIndex;
    const userIDString = "User" + (userIndex + 1);
    const userEvents = rectData[0][userIDString].events;

    let allEvents = userEvents.map(event => new Date(event.eventStartTimeStamp).getTime());

    let earliestTimestamp = new Date(Math.min(...allEvents));
    let latestTimestamp = new Date(Math.max(...allEvents));

    // Adjust the timestamps to include the entire minute if the events are within the same minute
    earliestTimestamp = new Date(earliestTimestamp.setSeconds(0, 0));
    latestTimestamp = new Date(earliestTimestamp);
    latestTimestamp = new Date(latestTimestamp.setSeconds(59, 999));

    const plotBox2 = d3.select("#plot-box2").html(""); // Clear any existing content
    const margin = {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
    };
    const width = plotBox2.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = 100; // Fixed height for simplicity

    const svg = d3.select("#plot-box2")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);


    const timeRange = latestTimestamp - earliestTimestamp;
    // console.log(timeRange);
    const stepSize = timeRange / 4;

    const tickValues = [earliestTimestamp];
    for (let i = 1; i <= 3; i++) {
        tickValues.push(new Date(earliestTimestamp.getTime() + stepSize * i));
    }

    tickValues.push(latestTimestamp);

    const xScale = d3.scaleTime()
        .domain([earliestTimestamp, latestTimestamp])
        .range([0, width]);

    const timeFormat = d3.timeFormat("%M:%S");
    const xAxis = d3.axisTop(xScale)
        .tickValues(tickValues)
        .tickFormat(timeFormat)
        .tickPadding(5);

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(0,${margin.top})`)
        .call(xAxis)
        .selectAll("text")
        .style("font-size", "12px")
        .style("fill", "#666");


        const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background-color", "white")
        .style("max-width", "300px")
        .style("border", "1px solid #777")
        .style("border-radius", "5px")
        .style("padding", "10px")
        .style("font-size", "14px")
        .style("opacity", 0)
        .style("z-index", "1000")
        .style("white-space", "normal");

    const circleRadius = 10;
    const circleYPosition = margin.top + 20;
    let tooltipTimeout;
    userEvents.forEach(dataEvent => {
        const eventTime = new Date(dataEvent.eventStartTimeStamp).getTime();
        const visibleCircle = svg.append("circle")
            .attr("cx", xScale(new Date(eventTime)))
            .attr("cy", circleYPosition)
            .attr("r", circleRadius)
            .attr("fill", colorScale(userIDString))
            .on("mouseover", function(event) {
                const svgRect = svg.node().getBoundingClientRect();
                // const [eventX, eventY] = [event.pageX, event.pageY];
                const [tooltipX, tooltipY] = [event.pageX, event.pageY];
                // const mess = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Mauris sit amet mattis erat. Quisque laoreet metus id fermentum ultricies. Proin ultricies dignissim volutpat. Ut vulputate odio vel orci pharetra, eu varius dolor pretium. Aliquam dictum risus ac risus placerat luctus. In lacinia mi turpis, nec dapibus sapien fermentum quis. Pellentesque et ornare tortor. Fusce efficitur elit et ligula ultricies, in condimentum neque convallis. Duis pellentesque, mauris sit amet rutrum imperdiet, urna arcu tempus purus, ac pretium erat odio eget justo. Etiam sollicitudin elit nec diam ullamcorper euismod. Nunc non diam ut dolor porttitor cursus vitae quis ipsum. Maecenas eu enim pharetra, laoreet ex et, iaculis velit. Proin velit risus, rutrum non ipsum ut, fermentum lobortis diam";
                tooltip.html(dataEvent.message)
                .style("opacity", 1)
                .style("visibility", "hidden"); 
                const tooltipWidth = tooltip.node().getBoundingClientRect().width;
                const tooltipHeight = tooltip.node().getBoundingClientRect().height;
                const padding = 20; 
                let adjustedX = tooltipX + padding;
                let adjustedY = tooltipY + padding;
                if (tooltipX + tooltipWidth + padding > window.innerWidth) {
                    adjustedX = window.innerWidth - tooltipWidth - padding;
                }
                if (tooltipY + tooltipHeight + padding > window.innerHeight) {
                    adjustedY = window.innerHeight - tooltipHeight - padding;
                }
                tooltip.style("left", adjustedX + "px")
                .style("top", adjustedY + "px")
                .style("visibility", "visible"); // Make tooltip visible again
                  })
                  .on("mouseout", function() {
                  tooltip.style("opacity", 0)
                        .style("visibility", "hidden"); // Hide tooltip
                  })           
                  .on("mouseout", function() {
                tooltip.style("opacity", 0);
            });
          })
      }



function plotOneBarchart(data) {
  // Flatten data structure to an array suitable for plotting
  const dataArray = Object.keys(data).flatMap(userId =>
    data[userId].events.map(event => ({
      ...event,
      userId,
      time: new Date(event.startTime) // Ensure startTime is a Date object
    }))
  );

  // const timeExtents = d3.extent(dataArray, d => d.time);
  const plotBox1 = d3.select("#plot-box1").html("");
  const margin = {
    top: 20,
    right:50,
    bottom: 20,
    left: 50
    };
    const width = plotBox1.node().getBoundingClientRect().width - margin.left - margin.right;
    const height = plotBox1.node().getBoundingClientRect().height - margin.top - margin.bottom;
  // const svg = plotBox1.append("svg")
  //     .attr("width", width + margin.left + margin.right)
  //     .attr("height", height + margin.top + margin.bottom)
  //     .append("g")
  //     .attr("transform", `translate(${margin.left},${margin.top})`);
  
  // X and Y axis setup
  // const x = d3.scaleTime().domain(timeExtents).range([0, width]);
  // const y = d3.scaleLinear().range([height, 0]);
  // const color = d3.scaleOrdinal(d3.schemeCategory10);
  let currentMetric = "duration";
  const updateButtonText = () => {
    const metricText = currentMetric === "duration" ? "Duration" : "Word Count";
    button.text(` ${metricText}`); 
  };

  // Button for toggling metric
  const container = d3.select("#plot-box1");
  const button = container.append("button")
  .text("Metric") // Set the button text
      .attr("class", "toggle-view") // Optionally set a class for styling
      .on("click", function() {
        currentMetric = (currentMetric === "duration") ? "wordCount" : "duration";
        updateChart(currentMetric);
        updateButtonText();
          
      });

      updateButtonText();
      const svg = plotBox1.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
      const timeExtents = d3.extent(dataArray.flatMap(d => [d.startTime, d.endTime]));

      const x = d3.scaleTime()
        .domain(timeExtents)
        .range([0, width]);

      const xAxis = d3.axisBottom(x)
        .tickFormat(d3.timeFormat("%M:%S"));

      svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

      const y = d3.scaleLinear()
        .domain([0, d3.max(dataArray, d => d[currentMetric])])
        .range([height, 0]);
    
      svg.append("g")
        .call(d3.axisLeft(y));
    
      const color = d3.scaleOrdinal(d3.schemeCategory10);
    
      function updateChart(metric) {
      y.domain([0, d3.max(dataArray, d => d[metric])]);
      svg.selectAll(".y.axis").call(d3.axisLeft(y)); 
    
      let bars = svg.selectAll(".bar").data(dataArray);
    
      bars.enter().append("rect")
          .attr("class", "bar")
        .merge(bars)
          .transition().duration(750)
          .attr("x", d => x(d.time))
          .attr("y", d => y(d[metric]))
          .attr("width", 10) // Fixed width for each bar
          .attr("height", d => height - y(d[metric]))
          .attr("fill", d => color(d.userId));
    
      bars.exit().remove();
      }
      updateChart(currentMetric);
}


function plotThreeLineplot() {
  const data = [
      { date: new Date(2020, 0, 1), value: 30 },
      { date: new Date(2020, 1, 1), value: 50 },
      { date: new Date(2020, 2, 1), value: 45 },
      { date: new Date(2020, 3, 1), value: 70 },
      { date: new Date(2020, 4, 1), value: 60 }
  ];
  const plotBox1 = d3.select("#plot-box1").html("");
  const margin = {top: 20, right: 30, bottom: 30, left: 50};
  const width = plotBox1.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = plotBox1.node().getBoundingClientRect().height - margin.top - margin.bottom;

  const svg = d3.select("#plot-box1").append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
    .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3.scaleTime()
      .domain(d3.extent(data, d => d.date))
      .range([0, width]);

     
  const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value)])
      .range([height, 0]);

  const xAxis = d3.axisBottom(x).tickFormat(d3.timeFormat("%m/%d"));
  svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis);

  svg.append("g")
      .call(d3.axisLeft(y));

  const line = d3.line()
      .x(d => x(d.date))
      .y(d => y(d.value));

  svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "steelblue")
      .attr("stroke-width", 1.5)
      .attr("d", line);
}


function plotFourSpiderChart(speechData, interactionData) {
  // Example data structure for the spider chart
  const data = [
    {axis: "Speech", value: 0.59},
    {axis: "Movement", value: 0.82},
    {axis: "XR Interaction", value: 0.72}
    // Add more axes/metrics if necessary
  ];
  const plotBox1 = d3.select("#plot-box1").html("");
  const margin = {top: 20, right: 30, bottom: 30, left: 50};
  const width = plotBox1.node().getBoundingClientRect().width - margin.left - margin.right;
  const height = plotBox1.node().getBoundingClientRect().height - margin.top - margin.bottom;
  // const width = plotBox1.node().getBoundingClientRect().width - margin.left - margin.right;
  // const height = plotBox1.node().getBoundingClientRect().height - margin.top - margin.bottom;
// const svg = plotBox1.append("svg")
  // Configuration for the Radar chart, including size, axes, and more
  const config = {
    w: width, // Width of the circle
    h: height, // Height of the circle
    maxValue: 1.0, // The maximum value on the scale
    levels: 5, // How many levels or inner circles should be drawn
    ExtraWidthX: 300 // Extra width for the legend
  };

  // Select the div where the chart will be rendered

  // Append an SVG for the chart
  const svg = plotBox1.append("svg")
    .attr("width", config.w + config.ExtraWidthX)
    .attr("height", config.h)
    .append("g");

  // RadarChart.draw() is a hypothetical function you'd replace with your radar chart drawing logic
  // This would involve calculating the positions for each axis, drawing the axes, the outer shape and the datapoints
  RadarChart.draw("#plot-box1", data, config);
}



function prepareDataForPlotting(data) {
    data.sort((a, b) => a.parsedStartTime - b.parsedStartTime);
    return data;
}


function createPlotInteraction(data) {
    // Select the container for the interaction plot
    const interactionView = d3.select("#interaction-plot-container");
    interactionView.html(""); // Clear any existing content

    // Set dimensions for the interaction plot
    const spatialViewWidth = document.getElementById('spatial-view').clientWidth;
    const margin = {
        top: 10,
        right: 40,
        bottom: 10,
        left: 70
    };
    const width = spatialViewWidth - margin.left - margin.right;
    const height = 100; // Set a fixed height for the interaction plot
    console.log(data);
    // Create the SVG element for the interaction plot
    const svg = interactionView.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);


    const text = "XR INTERACTION";
    const padding = 10;
    const textHeight = 100;
    const textWidth = 60;

    // Adjust for the rotation
    const rectX = -height / 2 - textHeight / 2 - padding;
    const rectY = -margin.left - textWidth / 2 - padding;

    // Width and height are adjusted for the longer text
    const rectWidth = textWidth + 2 * padding;
    const rectHeight = textHeight + 2 * padding;

    // Add a rectangle (box) for the background
    svg.append("rect")
        .attr("class", "title-rect")
        .attr("x", rectX)
        .attr("y", rectY - 10) // Slightly adjust the rectangle's position
        .attr("width", rectHeight + 10) // Width and height are swapped due to rotation, with a little extra for padding
        .attr("height", rectWidth)
        .attr("transform", "rotate(-90)")
        .style("fill", "lightgreen"); // Customize the fill and style as needed

    // Add the text, rotated similarly to the rectangle
    svg.append("text")
        .attr("class", "title-text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "13px")
        .text(text);

    // console.log(data);
    const interactionGroups = svg.selectAll(".interactionBarGroup")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "interactionBarGroup")
        .attr("transform", d => `translate(${x(d.parsedStartTime)},0)`);

    // Append rectangles for the interaction bars
    interactionGroups.append("rect")
        // .attr("x", d => x(d.parsedStartTime))
        .attr("x", 0)
        // .attr("transform", d => `translate(${x(d.parsedStartTime)},0)`)
        // .attr("y", 0) // Start at the top of the container
        // .attr("width",  d => x(d.parsedEndTime) - x(d.parsedStartTime))
        .attr("width", d => Math.max(5, x(d.parsedEndTime) - x(d.parsedStartTime)))
        .attr("y", d => d.UserId === 'User1' ? (height / 2) - 50 : (height / 2))
        .attr("height", height / 2) // Half the height of the container
        .attr("fill", d => colorScale(d.UserId));

    // Append text for the interaction bars
    interactionGroups.append("text")
        .text(d => d.Message) // Assuming there is an InteractionType field
        // .text("Raycast Hit")
        // .attr("x", d => x(d.parsedStartTime) + (x(d.parsedEndTime) - x(d.parsedStartTime)) / 2)
        .attr("x", d => (Math.max(5, x(d.parsedEndTime) - x(d.parsedStartTime))) / 2)
        // .attr("y", height / 4) // Center text in the bar
        .attr("y", d => d.UserId === 'User1' ? (height / 2) - 30 : (height / 2) + 25)
        // .attr("dy", ".35em") // Vertically center align the text
        .style("text-anchor", "middle")
        .style("font-size", "8px")
        .attr("fill", "contrastColor");
}




function createPlotSpeech(data) {
    const temporalViewContainer = d3.select("#temporal-view");
    const plotContainer = d3.select("#speech-plot-container");

    plotContainer.html("");

    // // const temporalView = d3.select("#interaction-plot-container");
    // const temporalView = parentTemporalView.select("#interaction-plot-container").html("");
    // temporalView.html("");
    const spatialViewWidth = document.getElementById('spatial-view').clientWidth;
    const margin = {
        top: 25,
        right: 40,
        bottom: 10,
        left: 70
    };
    const width = spatialViewWidth - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;
    const svg = plotContainer.append("svg")
        // const svg = temporalViewContainer.append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    // const verticalLine = svg.append('line')
    // .attr('x1', 0)
    // .attr('y1', 0)
    // .attr('x2', 0)
    // .attr('y2', height)
    // .attr('stroke', 'black')
    // .attr('stroke-width', '3')
    // .style('opacity', 0);
    const text = "VERBAL COMMUNICATION";
    const padding = 10; // Adjust padding around text
    const textHeight = 150; // Approximate or calculate the height of the text
    const textWidth = 60; //
    const rectX = -height / 2 - textHeight / 2 - padding; // Adjust for the rotation
    const rectY = -margin.left - textWidth / 2 - padding; // Adjust for the rotation
    const rectWidth = textWidth + 2 * padding;
    const rectHeight = textHeight + 2 * padding;

    svg.append("rect")
        .attr("class", "title-rect")
        .attr("x", rectX)
        .attr("y", rectY - 10)
        .attr("width", rectHeight + 10) // Width and height are swapped due to rotation
        .attr("height", rectWidth)
        .attr("transform", "rotate(-90)")
        .style("fill", "lightblue"); // Customize the fill and style as needed

    // Add the text
    svg.append("text")
        .attr("class", "title-text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0 - margin.left)
        .attr("x", 0 - (height / 2))
        .attr("dy", "1em")
        .style("text-anchor", "middle")
        .style("font-size", "13px")
        .text(text);

    const barGroups = svg.selectAll(".textBarGroup")
        .data(data)
        .enter()
        .append("g")
        .attr("class", "textBarGroup")
        .attr("transform", d => `translate(${x(d.parsedStartTime)},0)`);

    barGroups.append("rect")
        .attr("x", 0)
        .attr("y", d => d.UserId === 'User1' ? (height / 2) - 20 : (height / 2))
        .attr("width", d => {
            // Calculate width based on start and end times, but ensure it does not exceed a maximum width
            // This maximum width should be determined based on your data and the visual design
            const maxWidth = 100; // Example max width, adjust based on your needs
            const calculatedWidth = x(d.parsedEndTime) - x(d.parsedStartTime);
            //  console.log("this is the width" + calculatedWidth);
            return Math.max(maxWidth, calculatedWidth);
        })
        .attr("width", d => (x(d.parsedEndTime) - x(d.parsedStartTime)) / 2)
        .attr("height", 20)
        .attr("fill", d => colorScale(d.UserId))
        .attr("stroke", "black")
        .attr("stroke-width", 2);
    // console.log("this is the width" + x(d.parsedEndTime) - x(d.parsedStartTime));


    barGroups.append("text")
        .text(d => d.TranscriptionText)
        // .attr("x", d => {
        //   // Calculate the midpoint of the bar for text positioning
        //   const calculatedWidth = x(d.parsedEndTime) - x(d.parsedStartTime);
        //   const maxWidth = 20; // Assuming this is the same max width used for the bars
        //   const effectiveWidth = Math.max(maxWidth, calculatedWidth);
        //   return x(d.parsedStartTime) + effectiveWidth / 2; // Position text at the midpoint of the bar
        // })
        .attr("x", d => (x(d.parsedEndTime) - x(d.parsedStartTime)) / 4)
        .attr("y", d => d.UserId === 'User1' ? (height / 2) - 5 : (height / 2) + 15)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "contrastColor");
    d3.select("#speech-plot-container").on("click", function(event) {
        // Directly use the event parameter to access the clicked element.
        var clickedElement = d3.select(event.target);
        console.log("Clicked on a specific rect in speech?");
        if (clickedElement.node().tagName === "rect") {
            // console.log("Rect clicked:", clickedElement.node());
            var rectData = clickedElement.data();
            console.log("Data bound to the clicked rect:", rectData);
        }
    });

}


function createLine(currentTimeStamp) {
    const svg = d3.select("#temporal-view");
    const margin = {
        top: 20,
        right: 30,
        bottom: 0,
        left: 40
    };
    const height = parseInt(svg.style("height")) - margin.top - margin.bottom;

    const width = parseInt(svg.style("width")) - margin.right - margin.left;
    const y1 = 24;

    let xPosition;
    if (currentTimeStamp) {
        xPosition = x(new Date(currentTimeStamp));
    } else {
        xPosition = x(intervals[0]);
    }

    xPosition = Math.max(0, Math.min(xPosition, width)) + margin.left;

    let circle = svg.select('#time-indicator-circle');
    if (circle.empty()) {
        circle = svg.append('circle')
            .attr('id', 'time-indicator-circle')
            .attr('r', 5)
            .style('fill', 'black');
    }


    // Drag functionality
    var drag = d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);

    function dragstarted(event, d) {
        d3.select(this).raise().classed("active", true);
    }

    function dragended(event, d) {
        d3.select(this).classed("active", false);
    }

    let line = svg.select('#time-indicator-line');
    if (line.empty()) {
        line = svg.append('line').attr('id', 'time-indicator-line');
    }


    // console.log("this is y2 " + height);
    // top: 20; left: 0; 

    line.attr('x1', xPosition)
        .attr('x2', xPosition)
        .attr('y1', y1)
        .attr('y2', height)
        .style('stroke', 'black')
        .style('stroke-width', '3')
        .style('opacity', 1)
        .call(drag);
    circle.attr('cx', xPosition)
        .attr('cy', y1)
        .call(drag);
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
                // console.log("this is start " + start );
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
        createLine(currentTimestamp);
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