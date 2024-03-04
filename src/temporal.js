// Import statements
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
import {updateIntervals} from "./script.js"
import {dragged} from "./script.js"
// import nest from 

let x;
let intervalWidth ; 
let intervals ; 
var bins = 5; 
let numUsers = 2 ; 

function changeBinSize(newBinSize) {
  // Create and dispatch a custom event with the new bin size
  var event = new CustomEvent('binSizeChange', { detail: newBinSize });
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
      // Load JSON data asynchronously for two users
      const dataUser1 = await d3.json("file1Texts.json");
      const dataUser2 = await d3.json("file1TextsNew.json");

      // Map over each dataset to add UserId and parse times
      const parsedDataUser1 = dataUser1.map(d => ({
          ...d,
          UserId: 'User1', // Assign UserId for User1's data
          parsedStartTime: new Date(d.StartTime),
          parsedEndTime: new Date(d.EndTime)
      }));


      const parsedDataUser2 = dataUser2.map(d => ({
          ...d,
          UserId: 'User2', // Assign UserId for User2's data
          parsedStartTime: new Date(d.StartTime),
          parsedEndTime: new Date(d.EndTime)
      }));

      // Combine the datasets
      let combinedDataSpeech = [...parsedDataUser1, ...parsedDataUser2];
      
      // Proceed with data preparation and plotting
      const preparedDataSpeech = prepareDataForPlotting(combinedDataSpeech);
      const dataUser1Interaction = await d3.json("file1Interactions.json");
      const dataUser2Interaction = await d3.json("file1InteractionsNew.json");

  // Map over each dataset to add UserId and parse times
  const parsedDataUser1Interaction = dataUser1Interaction.map(d => ({
      ...d,
      UserId: 'User1', // Assign UserId for User1's data
      parsedStartTime: new Date(d.StartTime),
      parsedEndTime: new Date(d.EndTime)
  }));


  const parsedDataUser2Interaction = dataUser2Interaction.map(d => ({
      ...d,
      UserId: 'User2', // Assign UserId for User2's data
      parsedStartTime: new Date(d.StartTime),
      parsedEndTime: new Date(d.EndTime)
  }));

  // Combine the datasets
  let combinedDataInteraction = [...parsedDataUser1Interaction, ...parsedDataUser2Interaction];

  // Proceed with data preparation and plotting
  const preparedDataInteraction = prepareDataForPlotting(combinedDataInteraction);
  let allCombinedData = [...combinedDataSpeech, ...combinedDataInteraction];
  createSharedAxis(allCombinedData);
  const aggregatedDataInteraction = aggregateDataIntervalInteraction(preparedDataInteraction, intervals);
  const aggregatedDataSpeech = aggregateDataIntervalSpeech(preparedDataSpeech, intervals);
  aggregatedDataSpeech.pop();

  // console.log("this is aggregated data by speech" + aggregatedDataSpeech);
  createPlotAggregatedInteractions(aggregatedDataInteraction);
  createPlotAggregatedSpeech(aggregatedDataSpeech);
  const startingPointLine = x(intervals[0]) + 5 ;
  // console.log(" this is startingPoitnLine " + startingPointLine);
  createLine(startingPointLine);
  // createPlotSpeech(preparedData);
  
  // createPlotInteraction(preparedDataTemp);
      
  } catch (error) {
      console.error("Error loading or processing the JSON data", error);
  }
}


function createSharedAxis(data) {
  const temporalViewContainer = d3.select("#temporal-view");
  const sharedAxisContainer = temporalViewContainer.select("#shared-axis-container");
  sharedAxisContainer.html(""); 
  const margin = { top: 20, right: 30, bottom: 10, left: 40 };
  // const viewportWidth = window.innerWidth;
  const scaling = 50 ; 
  // const width = document.getElementById('spatial-view').clientWidth - margin.left - margin.right - scaling;
  const width = window.innerWidth ;
  const startTime = d3.min(data, d => d.parsedStartTime);
  const somePadding = 0;
  const endTime = new Date(d3.max(data, d => d.parsedEndTime).getTime() + somePadding);
  const totalTime = endTime - startTime; // in milliseconds
  const intervalDuration = totalTime / bins; 
  intervals = Array.from({ length: bins + 1  }, (v, i) => new Date(startTime.getTime() + i * intervalDuration));
  const widthh = width - margin.right - margin.left  ; 
  
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
  .tickFormat(d3.timeFormat("%H:%M:%S"));

  const svg = sharedAxisContainer.append("svg")
      .attr("width", width)
      .attr("height", margin.top + margin.bottom + axisHeight) 
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  const axisGroup = svg.append("g")
    .attr("transform", `translate(0,${margin.top - 15})`)
    .call(xAxis);

}

function aggregateDataIntervalInteraction(data, intervals) {
  const countsPerInterval = intervals.map(interval => ({
      User1: {count: {}, events: []},
      User2: {count: {}, events: []},
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
                eventStartTimeStamp : startTime,
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

// function aggregateDataIntervalSpeech(data, intervals) {
//   const dataPerInterval = intervals.map(interval => ({
//     intervalStart: interval,
//     intervalEnd: new Date(interval.getTime() + (intervals[1].getTime() - intervals[0].getTime())),
//     dataPoints: []
//   }));

//   data.forEach(d => {
//     const startTime = d.StartTime;
//     for (let i = 0; i < dataPerInterval.length; i++) {
//       if (startTime >= dataPerInterval[i].intervalStart && startTime < dataPerInterval[i].intervalEnd) {
//         dataPerInterval[i].dataPoints.push(d);
//         break; 
//       }
//     }
//   });
//   return dataPerInterval;
// }

function aggregateDataIntervalSpeech(data, intervals) {
  const dataPerInterval = intervals.map(interval => ({
    intervalStart: interval,
    intervalEnd: new Date(interval.getTime() + (intervals[1].getTime() - intervals[0].getTime())),
    User1: { events: [] }, // Initialize events array for User1
    User2: { events: [] }  // Initialize events array for User2
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
          eventEndTimeStamp: endTime
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
  //     console.log(`  Event ${eventIndex + 1}: saying this  ${event.transcriptionText} starting at this time  ${event.eventStartTimeStamp}`);
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
  const margin = { top: 0, right: 40, bottom: 0, left: 40 };
  // const width = spatialViewWidth - margin.left - margin.right;
  const width = window.innerWidth;
  // const height = temporalViewHeight/2 - margin.top - margin.bottom;
  const height = 100 ; 
  const svg = plotContainer.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom) 
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

      const colorScale = d3.scaleOrdinal()
      .domain(["User1", "User2"])
      .range(["#31a354", "#c51b8a"]);

  const barHeight = height / 4; 

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
      yPos = (height / 2) - barHeight - 5 ;
    } else {
      yPos = (height / 2); 
    }
    color = colorScale(userIndex +  1);
    const xPos = x(intervalData.intervalStart) ; 
    svg.append("rect")
    .attr("class", `speech-rect user-${userIndex}`)
    .data([{ ...intervalData, userIndex }])
    // .data([{parsedStartTime: intervalData.intervalStart, parsedEndTime: intervalData.intervalEnd}]) 
        // .attr("x", x(intervalData.intervalStart))
        .attr("x",xPos)
        .attr("y", yPos)
        .attr("width", barWidth)
        .attr("height", barHeight) // Use fixed bar height
        .attr("fill", color);
        // .attr("stroke", "black") 
        // .attr("stroke-width", 2); 
    const textYPos = yPos + barHeight / 2;
    
    svg.append("text")
        .attr("x", x(intervalData.intervalStart) + barWidth/2)
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
  const rectX = -height / 2 - textHeight / 2 ; 
  const rectY = -margin.left - textWidth / 2 ; 
  const rectWidth = textWidth ;
  const rectHeight = textHeight ;
 
  svg.append("rect")
    .attr("class", "title-rect")
    .attr("x", rectX)
    .attr("y", rectY ) 
    .attr("width", rectHeight ) 
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
      if(clickedElement.node().tagName === "rect") {
        var rectData = clickedElement.data();
        plotMagnifiedData(rectData);
      }
    });
}


function createPlotAggregatedInteractions(aggregatedData) {
  const temporalViewContainer = d3.select("#temporal-view");
  const plotContainer = d3.select("#interaction-plot-container");
  plotContainer.html("");
  const spatialViewWidth = document.getElementById('spatial-view').clientWidth;
  // const margin = { top: 20, right: 40, bottom: 30, left: 30 };
  const margin = { top: 0, right: 40, bottom: 0, left: 30 };
  const fixedHeight = 100; // Example fixed height
  // console.log("this is fixed height" + fixedHeight);
  // const width = spatialViewWidth - margin.left - margin.right;
  const width = window.innerWidth;
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

  const colorScale = d3.scaleOrdinal()
      .domain(["User1", "User2"])
      .range(["#f7fcb9", "#fde0dd"]);

  const barHeight = fixedHeight / 4; 

  activeIntervals.forEach((intervalData, intervalIndex) => {
    ['User1', 'User2'].forEach((user, userIndex) => {
      const barWidth = x(intervalData.intervalEnd) - x(intervalData.intervalStart);
      const xPos = x(intervalData.intervalStart) -2   ;
      let totalInteractionsPerInterval = Object.values(intervalData[user].count).reduce((sum, count) => sum + count, 0);
          // const messages = intervalData[user];
          // let messageTexts = Object.entries(messages).map(([message, count]) => `INTERACTION (${count})`).join(", ");
          // const interactions = Object.values(intervalData[user]).reduce((sum, count) => sum + count, 0);
          // totalInteractionsPerInterval += interactions;
          let messageTexts = Object.entries(intervalData[user].count)
          .map(([message, count]) => `${message} (${count})`)
          .join(", ");
          if (messageTexts !== "") {
      let yPos;
      let color;
      if (userIndex === 0) {
        yPos = (fixedHeight / 2) - barHeight - 5; 
        color = d3.interpolateRgb(colorScale(user), "#31a354")(totalInteractionsPerInterval / maxInteractions);

      } else {
        yPos = (fixedHeight / 2) + 5; // Adjust spacing and position as needed
        color = d3.interpolateRgb(colorScale(user), "#c51b8a")(totalInteractionsPerInterval / maxInteractions);
      }

      svg.append("rect")
      .attr("class", `interaction-rect user-${userIndex}`)
      // .data([intervalData])
      .data([{ ...intervalData, userIndex }])
      // .data([{parsedStartTime: intervalData.intervalStart, parsedEndTime: intervalData.intervalEnd}]) 
          .attr("x", xPos  )
          .attr("y", yPos)
          .attr("width", barWidth)
          .attr("height", barHeight) 
          .attr("fill", color);
          // .attr("stroke", "black") 
          // .attr("stroke-width", 2); 
      const textYPos = yPos + barHeight / 2 ;
      const textXPos = 10 ;

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
  const rectX = -fixedHeight / 2 - textHeight / 2 ;
  const rectY = -margin.left - textWidth / 2 ;
  const rectWidth = textWidth ;
  const rectHeight = textHeight;
  svg.append("rect")
    .attr("class", "title-rect")
    .attr("x", rectX)
    .attr("y", rectY ) // Slightly adjust the rectangle's position
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
      // console.log("Clicked on a specific rect in interaction?");
      if(clickedElement.node().tagName === "rect") {
        // console.log("Rect clicked:", clickedElement.node());
        var rectData = clickedElement.data();
        // console.log("Data bound to the clicked rect:", rectData);
        // console.log("this is rectData len " + rectData.length);
        plotMagnifiedData(rectData);
      }
    });
    
}

function plotMagnifiedData(rectData) {
  // Extract user index from the rectData
  const userIndex = rectData[0].userIndex;
  const userIDString = "User" + (userIndex + 1); 
  const userEvents = rectData[0][userIDString].events;

  let allEvents = [];
  userEvents.forEach(event => {
    allEvents.push(new Date(event.eventStartTimeStamp).getTime());
    allEvents.push(new Date(event.eventEndTimeStamp).getTime());
  });
  
  let earliestTimestamp = new Date(Math.min(...allEvents));
  let latestTimestamp = new Date(Math.max(...allEvents));
  // if (latestTimestamp - earliestTimestamp < 1000) { // Less than 1 second difference
  if (latestTimestamp === earliestTimestamp){
    console.log("here");
    earliestTimestamp = new Date(earliestTimestamp.setSeconds(0, 0)); 
    latestTimestamp = new Date(earliestTimestamp); 
    latestTimestamp = new Date(latestTimestamp.setSeconds(59, 0)); 
  }
  // console.log("timestanps" + earliestTimestamp);
  // console.log(latestTimestamp);
  const plotBox2 = d3.select("#plot-box2").html("");
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
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
  console.log(timeRange);
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
    .tickFormat(timeFormat);

  svg.append("g")
    .attr("class", "x-axis")
    .attr("transform", `translate(0,${margin.top})`)
    .call(xAxis)
    .selectAll("text")
    .style("font-size", "7px"); 

    userEvents.forEach(event => {
      const startTime = new Date(event.eventStartTimeStamp).getTime();
      const endTime = new Date(event.eventEndTimeStamp).getTime();
      let duration = endTime - startTime; // Duration in ms
    
      
      if (duration === 0 ) { duration = 1000; }
      console.log("this is duration " + duration);
        console.log(new Date(startTime));
      console.log(new Date (endTime));
      svg.append("rect")
        .attr("x", xScale(new Date(startTime)))
        .attr("width", xScale(new Date(startTime + duration)) - xScale(new Date(startTime)))
        .attr("y", rectYPosition) 
        .attr("height", rectHeight) 
        .attr('stroke', 'black') 
  .attr('stroke-width', '1')
        .attr("fill", "#69b3a2"); 
    });


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
  const margin = { top: 10, right: 40, bottom: 10, left: 70 };
  const width = spatialViewWidth - margin.left - margin.right;
  const height = 100; // Set a fixed height for the interaction plot
  console.log(data);
  // Create the SVG element for the interaction plot
  const svg = interactionView.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Define a color scale for the interaction bars
  const colorScale = d3.scaleOrdinal()
    .domain(["User1", "User2"])
    .range(["#69b3a2", "#ff6347"]);


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
  const margin = { top: 30, right: 40, bottom: 10, left: 70 };
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
  .attr("y", rectY-10)
  .attr("width", rectHeight +10) // Width and height are swapped due to rotation
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

  const colorScale = d3.scaleOrdinal()
  .domain(["User1", "User2"])
  .range(["#69b3a2", "#ff6347"]);

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
    if(clickedElement.node().tagName === "rect") {
      // console.log("Rect clicked:", clickedElement.node());
      var rectData = clickedElement.data();
      console.log("Data bound to the clicked rect:", rectData);
    }
  });

}


function createLine(currentTimeStamp) {
  const svg = d3.select("#temporal-view");
  const margin = { top: 0, right: 30, bottom: 0, left: 40 };
  const height = parseInt(svg.style("height")) - margin.top - margin.bottom;
  
  const width = parseInt(svg.style("width")) - margin.right - margin.left;
  const y1 = 24 ;

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
        if( d !== undefined){
          console.log(d);
          // const start = new Date(d.eventStartTimeStamp).getTime(); 
          // const end = new Date(d.eventEndTimeStamp).getTime();
         
          //zainab please come here and fix this 

          // console.log("this is d[0] " + d.length );
          //zainab please come here and sort it out 
          const start = d.intervalStart.getTime();
          const end = d.intervalEnd.getTime(); 
          console.log("this is start " + start );
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
            if( d != undefined){
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

function animateGroupedInteractions(currentTimeStamp){
  const interactionSvg = d3.select("#interaction-plot-container svg"); 
  if (!interactionSvg.empty()) {
  const allInteractionRects = interactionSvg.selectAll("rect.interaction-rect");
  allInteractionRects.each(function(d, i) {
    if( d != undefined ){
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

// export function updateTemporalPlotSize() {
//   // Get the dimensions of the container
//   const temporalView = d3.select("#temporal-view");
//   const boundingRect = temporalView.node().getBoundingClientRect();

//   const margin = { top: 50, right: 40, bottom: 40, left: 70 };
//   const width = boundingRect.width - margin.left - margin.right;
//   const height = boundingRect.height - margin.top - margin.bottom;

//   // Update the width and height of the SVG container
//   const svg = temporalView.select("svg")
//     .attr("width", boundingRect.width)
//     .attr("height", boundingRect.height)
//     .select("g")
//     .attr("transform", `translate(${margin.left},${margin.top})`);

//   // Update the x scale range
//   x.range([0, width]);

//   // Update the axis
//   svg.select(".x-axis") // Make sure you have this class attached to your x-axis group
//     .attr("transform", `translate(0,${height})`)
//     .call(d3.axisTop(x).tickFormat(d3.timeFormat("%H:%M:%S")));

//   // Update all other elements that depend on the width
//   svg.selectAll(".textBarGroup rect")
//     .attr("width", d => x(d.parsedEndTime) - x(d.parsedStartTime))
//     .attr("y", d => d.UserId === 'User1' ? (height / 2) - 20 : (height / 2))
//     .attr("height", 20);

//   // Update text elements similarly
//   svg.selectAll(".textBarGroup text")
//     .attr("x", d => (x(d.parsedEndTime) + x(d.parsedStartTime)) / 2)
//     .attr("y", d => d.UserId === 'User1' ? (height / 2) - 5 : (height / 2) + 15);

//   // Update the vertical line if it's present
//   svg.select('.current-time-line')
//     .attr('y2', height);
// }



export function getXScale() {
  return x;
}


