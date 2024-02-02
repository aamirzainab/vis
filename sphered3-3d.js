/**
 * Created with d3-3d, https://github.com/niekes/d3-3d
 */
import {
    drag,
    select,
    randomInt,
    selectAll,
    scaleLinear,
    interpolatePiYG,
} from 'https://cdn.skypack.dev/d3@7.8.5';

import {
    triangles3D,
} from 'https://cdn.skypack.dev/d3-3d@1.0.0';


alert("SPHERE.js is loaded!");
const origin = { x: 480, y: 250 };
const scale = 1;
const startAngle = Math.PI / 4;
const colorScale = scaleLinear();
let triangles = [];
let alpha = 0;
let beta = 0;
let mx, my, mouseX = 0, mouseY = 0;

const svg = select('svg')
    .call(drag()
      .on('drag', dragged)
      .on('start', dragStart)
      .on('end', dragEnd))
    .append('g');

const triangles3d = triangles3D()
    .x((d) => d.x)
    .y((d) => d.y)
    .z((d) => d.z)
    .rotateY(startAngle)
    .rotateX(-startAngle)
    .origin(origin)
    .scale(scale);

function init() {
    const randomRadius = randomInt(50, 225)();
    
    colorScale.domain([0, 25]);
    
    const sphereData = createSphereDataset(randomRadius, 25, 25);

    processData(triangles3d(sphereData), 750);
}

function processData(data, tt) {
    const triangles = svg.selectAll('path.triangles').data(data, (d) => d.id);

    triangles
      .enter()
      .append('path')
      .attr('class', 'triangles')
      .attr('fill', d => d.fill)
      .attr('fill-opacity', 0)
      .attr('stroke-opacity', 0.25)
      .merge(triangles)
      .classed('d3-3d', true)
      .attr('stroke', '#333')
      .transition().duration(tt)
      .attr('opacity', 1)
      .attr('fill', d => d.fill)
      .attr('fill-opacity', 0.75)
      .attr('d', triangles3d.draw);

    triangles.exit().remove();

    selectAll('.d3-3d').sort(triangles3d.sort);
}

function createSphereDataset(radius, widthSegments, heightSegments) {
    triangles = [];

    for (let i = 0; i < heightSegments; i++) {
        const fill = interpolatePiYG(colorScale(i));
        const theta1 = (i / heightSegments) * Math.PI;
        const theta2 = ((i + 1) / heightSegments) * Math.PI;
        const sinTheta1 = Math.sin(theta1);
        const cosTheta1 = Math.cos(theta1);
        const sinTheta2 = Math.sin(theta2);
        const cosTheta2 = Math.cos(theta2);

        for (let j = 0; j < widthSegments; j++) {
            const phi1 = (j / widthSegments) * (Math.PI * 2);
            const phi2 = ((j + 1) / widthSegments) * (Math.PI * 2);
            const sinPhi1 = Math.sin(phi1);
            const cosPhi1 = Math.cos(phi1);
            const sinPhi2 = Math.sin(phi2);
            const cosPhi2 = Math.cos(phi2);

            const vertex1 = {
                x: radius * cosPhi1 * sinTheta1,
                y: radius * cosTheta1,
                z: radius * sinPhi1 * sinTheta1,
            };

            const vertex2 = {
                x: radius * cosPhi2 * sinTheta1,
                y: radius * cosTheta1,
                z: radius * sinPhi2 * sinTheta1,
            };

            const vertex3 = {
                x: radius * cosPhi1 * sinTheta2,
                y: radius * cosTheta2,
                z: radius * sinPhi1 * sinTheta2,
            };

            const vertex4 = {
                x: radius * cosPhi1 * sinTheta2,
                y: radius * cosTheta2,
                z: radius * sinPhi1 * sinTheta2,
            };

            const vertex5 = {
                x: radius * cosPhi2 * sinTheta1,
                y: radius * cosTheta1,
                z: radius * sinPhi2 * sinTheta1,
            };

            const vertex6 = {
                x: radius * cosPhi2 * sinTheta2,
                y: radius * cosTheta2,
                z: radius * sinPhi2 * sinTheta2,
            };
            
            const triangle1 = [vertex1, vertex2, vertex3];
            const triangle2 = [vertex4, vertex5, vertex6];

            triangle1.id = `${i}-1-${j}`;
            triangle2.id = `${i}-2-${j}`;
            triangle1.fill = fill;
            triangle2.fill = fill;

            triangles.push(triangle1, triangle2);
        }
    }

    return triangles;
}

function dragStart() {
    mx = event.x;
    my = event.y;
}

function dragged(event) {
    beta = (event.x - mx + mouseX) * Math.PI / 230;
    alpha = (event.y - my + mouseY) * Math.PI / 230 * (-1);

    processData(triangles3d.rotateY(beta + startAngle).rotateX(alpha - startAngle)(triangles), 0);
}

function dragEnd(event) {
    mouseX = event.x - mx + mouseX;
    mouseY = event.y - my + mouseY;
}

select('button').on('click', init);

init();
