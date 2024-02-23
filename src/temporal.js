// Import statements
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as THREE from "https://cdn.skypack.dev/three@0.132.2";
// import nest from 

let x;
let intervalWidth ; 
let intervals ; 
var bins = 5; 
// let bins = 5 

function changeBinSize(newBinSize) {
  // Create and dispatch a custom event with the new bin size
  var event = new CustomEvent('binSizeChange', { detail: newBinSize });
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
      let combinedData = [...parsedDataUser1, ...parsedDataUser2];
      
      // Proceed with data preparation and plotting
      const preparedData = prepareDataForPlotting(combinedData);
      const dataUser1Temp = await d3.json("file1Interactions.json");
      const dataUser2Temp = await d3.json("file1InteractionsNew.json");

  // Map over each dataset to add UserId and parse times
  const parsedDataUser1Temp = dataUser1Temp.map(d => ({
      ...d,
      UserId: 'User1', // Assign UserId for User1's data
      parsedStartTime: new Date(d.StartTime),
      parsedEndTime: new Date(d.EndTime)
  }));


  const parsedDataUser2Temp = dataUser2Temp.map(d => ({
      ...d,
      UserId: 'User2', // Assign UserId for User2's data
      parsedStartTime: new Date(d.StartTime),
      parsedEndTime: new Date(d.EndTime)
  }));

  // Combine the datasets
  let combinedDataTemp = [...parsedDataUser1Temp, ...parsedDataUser2Temp];

  // Proceed with data preparation and plotting
  const preparedDataTemp = prepareDataForPlotting(combinedDataTemp);
  let allCombinedData = [...combinedData, ...combinedDataTemp];
  createSharedAxis(allCombinedData);
  const aggregatedData = aggregateDataByInterval(preparedDataTemp, intervals);
  createPlotAggragatedInteractions(aggregatedData);
  createPlotSpeech(preparedData);
  
  // createPlotInteraction(preparedDataTemp);
      
  } catch (error) {
      console.error("Error loading or processing the JSON data", error);
  }
}


function createSharedAxis(data) {
  const temporalViewContainer = d3.select("#temporal-view");
  const sharedAxisContainer = temporalViewContainer.select("#shared-axis-container");
  sharedAxisContainer.html(""); 
  const spatialViewWidth = document.getElementById('spatial-view').clientWidth;
  const margin = { top: 20, right: 30, bottom: 10, left: 30 };
  const width = spatialViewWidth - margin.left - margin.right;
  const startTime = d3.min(data, d => d.parsedStartTime);
  const endTime = new Date(d3.max(data, d => d.parsedEndTime).getTime() + 5000);
  // const endTime = d3.max(data, d => d.parsedEndTime);
  const totalTime = endTime - startTime; // This is in milliseconds
  const intervalDuration = totalTime / bins; 
  // intervals = [0, 1, 2, 3,4 ].map(i => new Date(startTime.getTime() + i * intervalDuration));
  console.log("rthis is starttime " + startTime);
  intervals = Array.from({ length: bins + 1 }, (v, i) => new Date(startTime.getTime() + i * intervalDuration));
  const somePadding = 5000;
  intervalWidth = (totalTime) / bins;

  x = d3.scaleTime()
      .domain([
          d3.min(data, d => d.parsedStartTime),
          endTime
          // d3.max(data, d => d.parsedEndTime) 
      ]) 
      .range([0, width]);
      // console.log( "start " + d3.min(data, d => d.parsedStartTime) + "end " +  d3.max(data, d => d.parsedEndTime))
const axisHeight = 30; 

const xAxis = d3.axisTop(x)
.tickValues(intervals) // Set custom tick values
.tickFormat(d3.timeFormat("%H:%M:%S"));

const svg = sharedAxisContainer.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", margin.top + margin.bottom + axisHeight) 
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

    const axisGroup = svg.append("g")
  .attr("transform", `translate(0,${margin.top - 15})`)
  .call(xAxis);

}

function aggregateDataByInterval(data, intervals) {
  const countsPerInterval = intervals.map(interval => ({
      User1: {},
      User2: {},
      intervalStart: interval,
      intervalEnd: new Date(interval.getTime() + (intervals[1].getTime() - intervals[0].getTime()))
  }));

  data.forEach(d => {
      const user = d.UserId;
      const startTime = d.parsedStartTime;
      for (let i = 0; i < intervals.length - 1; i++) {
          if (startTime >= intervals[i] && startTime < intervals[i + 1]) {
              const message = d.Message;
              if (!countsPerInterval[i][user][message]) {
                  countsPerInterval[i][user][message] = 1;
              } else {
                  countsPerInterval[i][user][message] += 1;
              }
          }
      }
  });

  return countsPerInterval;
}


function createPlotAggragatedInteractions(aggregatedData) {
  const temporalViewContainer = d3.select("#temporal-view");
  const plotContainer = d3.select("#interaction-plot-container");
  plotContainer.html("");
  const spatialViewWidth = document.getElementById('spatial-view').clientWidth;
  const margin = { top: 20, right: 30, bottom: 30, left: 30 };
  const fixedHeight = 100; // Example fixed height
  const width = spatialViewWidth - margin.left - margin.right;

  let maxInteractions = 0;
  const activeIntervals = aggregatedData.filter(intervalData => {
    const totalInteractions = ['User1', 'User2'].reduce((acc, user) => {
        return acc + Object.values(intervalData[user]).reduce((sum, count) => sum + count, 0);
    }, 0);
    return totalInteractions > 0;
  });
  activeIntervals.forEach(intervalData => {
    ['User1', 'User2'].forEach(user => {
        const interactions = Object.values(intervalData[user]).reduce((sum, count) => sum + count, 0);
        maxInteractions = Math.max(maxInteractions, interactions);
    });
  });

  const svg = plotContainer.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", fixedHeight + margin.top + margin.bottom) // Use fixed height here
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

  const colorScale = d3.scaleOrdinal()
      .domain(["User1", "User2"])
      .range(["#f7fcb9", "#fde0dd"]);

  // Set a fixed height for the bars
  const barHeight = fixedHeight / 4; // Example calculation for bar height

  activeIntervals.forEach((intervalData, intervalIndex) => {
    ['User1', 'User2'].forEach((user, userIndex) => {
      const barWidth = x(intervalData.intervalEnd) - x(intervalData.intervalStart);
      let totalInteractionsPerInterval = 0 ; 
          const messages = intervalData[user];
          // console.log(" this is messages "+ messages);
          // let messageTexts = Object.entries(messages).map(([message, count]) => `${message} (${count})`).join(", ");
          let messageTexts = Object.entries(messages).map(([message, count]) => `RAYCAST (${count})`).join(", ");
          // console.log("this is messageTexts" + messageTexts);
          // const barWidth = x(intervalData.intervalEnd) - x(intervalData.intervalStart);
          const interactions = Object.values(intervalData[user]).reduce((sum, count) => sum + count, 0);
          totalInteractionsPerInterval += interactions;
          if (messageTexts !== "") {
      let yPos;
      let color;
      if (userIndex === 0) {
        yPos = (fixedHeight / 2) - barHeight - 5; // Adjust spacing and position as needed
        color = d3.interpolateRgb(colorScale(user), "#31a354")(totalInteractionsPerInterval / maxInteractions);

      } else {
        yPos = (fixedHeight / 2) + 5; // Adjust spacing and position as needed
        color = d3.interpolateRgb(colorScale(user), "#c51b8a")(totalInteractionsPerInterval / maxInteractions);
      }
      // const color = colorScale(user);

      // const messageTexts = Object.entries(intervalData[user])
  // .map(([message, count]) => `${message} (${count})`)
  // .join(", ");

      svg.append("rect")
      .attr("class", `interaction-rect user-${userIndex}`)
      .data([{parsedStartTime: intervalData.intervalStart, parsedEndTime: intervalData.intervalEnd}]) 
          .attr("x", x(intervalData.intervalStart))
          .attr("y", yPos)
          .attr("width", barWidth)
          .attr("height", barHeight) // Use fixed bar height
          .attr("fill", color)
          .attr("stroke", "black")
          .attr("stroke-width", 1);

      // Adjust text position based on fixed bar height as needed
      const textYPos = yPos + barHeight / 2;

      svg.append("text")
          .attr("x", x(intervalData.intervalStart) + 5)
          .attr("y", textYPos)
          // .text(intervalData[user].map(([message, count]) => `${message} (${count})`).join(", "))
          .text(messageTexts)
          .attr("fill", "contrastColor") // Ensure text color is visible
          .style("font-size", "10px")
          .attr("dominant-baseline", "middle"); // Center text vertically within the bar
    }
    });
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
  // const parentTemporalView = d3.select("#temporal-view");

  const temporalViewContainer = d3.select("#temporal-view");
  // const plotContainer = temporalViewContainer.select("#speech-plot-container");
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
  .attr("width", d => x(d.parsedEndTime) - x(d.parsedStartTime))
  .attr("height", 20)
  .attr("fill", d => colorScale(d.UserId));

  barGroups.append("text")
  .text(d => d.TranscriptionText)
  .attr("x", d => (x(d.parsedEndTime) - x(d.parsedStartTime)) / 2)
  .attr("y", d => d.UserId === 'User1' ? (height / 2) - 5 : (height / 2) + 15)
  .attr("text-anchor", "middle")
  .attr("font-size", "12px")
  .attr("fill", "contrastColor"); 

}


export function animateTemporalView(currentTimestamp) {
  const svg = d3.select("#temporal-view");
 
  if (!svg.empty()) {
      // const allRects = svg.selectAll("rect").style("opacity", 0.2); 
      // const allTexts = svg.selectAll("text").style("opacity", 0.2); 
      const allRects = svg.selectAll("rect:not(.title-rect)").style("opacity", 0.2);
      const allTexts = svg.selectAll("text:not(.title-text)").style("opacity", 0.2);
      
      allRects.each(function(d, i) {
        if( d != undefined){
        
          const start = d.parsedStartTime.getTime();
          const end = d.parsedEndTime.getTime(); 
          // console.log("start" + start);
          if (currentTimestamp >= start && currentTimestamp < end) {

              d3.select(this).style("opacity", 1); 
              d3.select(allTexts.nodes()[i]).style("opacity", 1); 
          }
        }
      });
      const interactionSvg = d3.select("#interaction-plot-container svg"); 
      if (!interactionSvg.empty()) {
        // console.log("r u here");
          const interactionRects = interactionSvg.selectAll("rect:not(.title-rect)").style("opacity", 0.2);
          const interactionTexts = interactionSvg.selectAll("text:not(.title-text)").style("opacity", 0.2);
          const opacityState = {};
          interactionRects.each(function(d, i) {
            if( d != undefined){
              const roundedTimestamp = Math.round(currentTimestamp);
              const start = d.parsedStartTime.getTime();
              const end = d.parsedEndTime.getTime();
              // console.log("this is start " + start);
              // console.log("this is currentTimeStamp " + roundedTimestamp);
              // console.log(start - roundedTimestamp);
              // console.log("this is end " + end);
              // console.log(currentTimestamp >= start, currentTimestamp <= end)
              // const start = 1707501487984
              // 1707501487984
              // 1707501494161.1553
              // 1707501487984

              // if (currentTimestamp >= start && currentTimestamp <= end) {
              //   // if (currentTimestamp >= start ){
              //   console.log("here??");
              //     d3.select(this).style("opacity", 1);
              //     d3.select(interactionTexts.nodes()[i]).style("opacity", 1);
              // }
              // duration_in_s = duration.total_seconds() 
              let diff1 = currentTimestamp - start;
              // Math.round((elapsedMs % 1000) / 10);
              diff1 = Math.abs((diff1 % 1000) / 10);
              // diff1 = diff1.total_seconds();
              // / 3600000;
              // console.log(" difffff1 " + diff1);
              let diff2 = end - currentTimestamp;
              // Math.round((elapsedMs % 1000) / 10);
              diff2 = Math.abs((diff2 % 1000) / 10);
              if (currentTimestamp >= start && currentTimestamp < end) {

                d3.select(this).style("opacity", 1); 
                d3.select(allTexts.nodes()[i]).style("opacity", 1); 
            }
              // diff1 = diff1.total_seconds();
              // / 3600000;
              // console.log(" difffff2 " + diff1);

              // if (diff1 < 1000 && diff2 < 1000) {

              //   // if (!opacityState[i]) {
              //     // console.log("here??");
              //     d3.select(this).style("opacity", 1);
              //     d3.select(interactionTexts.nodes()[i]).style("opacity", 1);
  
                  // Set opacity state to true for this rectangle
                  // opacityState[i] = true;
                  // setTimeout(() => {
                  //     d3.select(this).style("opacity", 0.2);
                  //     d3.select(interactionTexts.nodes()[i]).style("opacity", 0.2);
                  //     opacityState[i] = false;
                  // }, 1); 
              // }
            // }
            }
          });
      }
      animateGroupedInteractions(currentTimestamp);
      const width = parseInt(svg.style("width"));
      let xPosition = x(new Date(currentTimestamp)); 
      xPosition = Math.max(0, Math.min(xPosition, width));
      const height = parseInt(svg.style("height"));
     
      svg.style("overflow", "visible");
      svg.select('line')
          .attr('x1', xPosition)
          .attr('x2', xPosition)
          .attr('y1', 0) // Start at the top of the SVG
          .attr('y2', -100) // Extend to the bottom of the SVG
          .style('opacity', 1)
          .style('stroke-width', '3') // Make the line thicker
          .style('stroke', 'black'); // Change color to red for better visibility
  }
}

function animateGroupedInteractions(currentTimeStamp){
  const interactionSvg = d3.select("#interaction-plot-container svg"); 
  if (!interactionSvg.empty()) {
  const allInteractionRects = interactionSvg.selectAll("rect.interaction-rect");
  allInteractionRects.each(function(d, i) {
    if( d != undefined ){
      // console.log("currrr " + currentTimeStamp)
    // console.log(d);
    const start = d.parsedStartTime.getTime();
          const end = d.parsedEndTime.getTime(); 
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




