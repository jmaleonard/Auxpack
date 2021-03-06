import React, { Component } from 'react';
import * as d3 from "d3";
import lodash from 'lodash';

//this component is a class component as D3 uses vanilla JS that references "this"
export default class Sunburst extends Component {
    constructor(props) {
        super(props)
    }
    //to create the chart on render
    componentDidMount() {
        this.drawChart();
    }

    shouldComponentUpdate(nextProps, nextState) {
        // only re-render if the data will change
        return !lodash.isEqual(nextProps.burstData, this.props.burstData);
    }
    //cleanup of all appends and other data to prevent perpetual filling of the DOM
    componentDidUpdate() {
        d3.select(this.svg).selectAll("g").remove();
        d3.select("#sequence").select("#trail").remove()
        //redraw when it rerenders
        this.drawChart();
    }

    drawChart() {
        /*
          D3 code to create our visualization by appending onto this.svg
        */

        // Dimensions of sunburst: have to be defined in script
        //client width and height/ inner width and height gets size of viewport to dynamically change size
        //important for mobile(PWA)
        const width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0) * .99;
        const height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        const radius = Math.min(width, height) / 3;
        const _self = this;

        // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
        const b = {
            w: 30, h: 20, s: 3, t: 8
        };

        //function to loop through colors based on project size
        const color = function () {
            let ctr = 0;
            const hex = ['#53c79f', '#64b0cc', '#7a6fca', '#ca6f96', '#e58c72', '#e5c072']
            return function () {
                if (ctr === hex.length - 1) {
                    ctr = 0;
                    return hex[ctr]
                } else {
                    ctr++
                    return hex[ctr]
                }
            }
        }

        const loopColors = color()

        // Total size of all segments; we set this later, after loading the data.
        let totalSize = 0;

        /*  ================ create the svg =================== */
        const vis = d3.select(this.svg)
            //styles the chart with info from above
            .attr("width", width)
            .attr("height", height)
            //appends to DOM
            .append("svg:g")
            .attr("id", "container")
            //moves the sunburst within the svg canvas
            .attr("transform", "translate(" + width / 2 + "," + height / 1.75 + ")");

        //hides the information that appears on hover until "activated"
        d3.select("#explanation")
            .style("visibility", "hidden");

        //defines pieces of burst that connects layers of modules
        const partition = d3.partition()
            .size([2 * Math.PI, radius * radius]);

        //draws curves of partitions
        const arc = d3.arc()
            .startAngle(function (d) { return d.x0; })
            .endAngle(function (d) { return d.x1; })
            .innerRadius(function (d) { return Math.sqrt(d.y0); })
            .outerRadius(function (d) { return Math.sqrt(d.y1); });

        // Use d3.text and d3.csvParseRows so that we do not need to have a header
        // row, and can receive the csv as an array of arrays.
        const json = buildHierarchy(this.props.burstData);
        createVisualization(json);
        // Main function to draw and set up the visualization, once we have the data.
        function createVisualization(json) {
            // Basic setup of page elements.
            initializeBreadcrumbTrail();

            // Bounding circle underneath the sunburst, to make it easier to detect
            // when the mouse leaves the parent g.
            vis.append("svg:circle")
                .attr("r", radius)
                .style("opacity", 0);

            // Turn the data into a d3 hierarchy and calculate the sums.
            const root = d3.hierarchy(json)
                .sum(function (d) { return d.size; })
                .sort(function (a, b) { return b.value - a.value; });

            // For efficiency, filter nodes to keep only those large enough to see.
            const nodes = partition(root).descendants()
                .filter(function (d) {
                    return (d.x1 - d.x0 > 0.005); // 0.005 radians = 0.29 degrees
                });

            const path = vis.data([json]).selectAll("path")
                .data(nodes)
                .enter().append("svg:path")
                .attr("display", function (d) { return d.depth ? null : "none"; })
                .attr("d", arc)
                .attr("fill-rule", "evenodd")
                .style("fill", function (d) { return loopColors() })
                .style("opacity", 1)
                .on("mouseover", mouseover);

            // Add the mouseleave handler to the bounding circle.
            d3.select("#container").on("mouseleave", mouseleave);

            // Get total size of the tree = value of root node from partition.
            totalSize = path.datum().value;
        };

        // Fade all but the current sequence, and show it in the breadcrumb trail.
        function mouseover(d) {
            //math for information based on path
            let percentage = (100 * d.value / totalSize).toPrecision(3);
            let percentageString = percentage + "%";
            if (percentage < 0.1) {
                percentageString = "< 0.1%";
            }
            let size = ""
            const filesize = [1000, 1000000, 1000000000]
            let filesizeIndex = 0
            if (d.value > filesize[0]) {
                size = "KiB";
            }
            if (d.value > filesize[1]) {
                size = "MiB"
                filesizeIndex = 1
            }
            if (d.value > filesize[2]) {
                size = "GiB"
                filesizeIndex = 2
            }

            //ADDED PERCENTAGE OF BUNDLE
            d3.select("#percentage")
                .text(`${percentageString} of your bundle`);
            //ADDED FILE NAME
            d3.select("#filename")
                .text(d.data.name)

            //ADDED FILE SIZE
            d3.select("#filesize")
                .text(`Size: ${(d.value / filesize[filesizeIndex]).toFixed(2)} ${size}`)

            //Shows three parts of info above
            d3.select("#explanation")
                .style("visibility", "");

            const sequenceArray = d.ancestors().reverse();
            sequenceArray.shift(); // remove root node from the array
            let trickArray = sequenceArray.slice(0);
            // convert path array to a '/' seperated path string. add '/' at the end if it's a directory.
            const path = "./" + trickArray.map(node => node.data.name).join("/") + (trickArray[trickArray.length - 1].children ? "/" : "");
            _self.props.onHover(path);

            for (let i = 1; i < trickArray.length + 1; i++) {
                updateBreadcrumbs(trickArray.slice(0, i), percentageString);
            }
            // Fade all the segments.
            d3.selectAll("#chart").selectAll("path")
                .style("opacity", 0.3);

            // Then highlight only those that are an ancestor of the current segment.
            vis.selectAll("path")
                .filter(function (node) {
                    return (sequenceArray.indexOf(node) >= 0);
                })
                .style("opacity", 1);
        }

        // Restore everything to full opacity when moving off the visualization.
        function mouseleave(d) {

            // Hide the breadcrumb trail
            d3.select("#trail")
                .style("visibility", "hidden");

            // Deactivate all segments during transition.
            d3.selectAll("path").on("mouseover", null);

            // Transition each segment to full opacity and then reactivate it.
            d3.selectAll("#chart").selectAll("path")
                .transition()
                .duration(1000)
                .style("opacity", 1)
                .on("end", function () {
                    d3.select(this).on("mouseover", mouseover);
                });

            //Re-hides information on mouseleave
            d3.select("#explanation")
                .style("visibility", "hidden");

            _self.props.onHover(null);
        }

        function initializeBreadcrumbTrail() {
            // Add the svg area.
            let trail = d3.select("#sequence").append("svg:svg")
                .attr("width", width)
                .attr("height", 50)
                .attr("id", "trail");

            // Add the label at the end, for the percentage.
            trail.append("svg:text")
                .attr("id", "endlabel")
                .style("fill", "#3f51b5");   //controls the color of the percentage
        }

        // Generate a string that describes the points of a breadcrumb polygon.
        function breadcrumbPoints(d, i) {
            let points = [];
            points.push("0,0");
            points.push(b.w + d.data.name.length * 7.5 + ",0");  //CONTROLS THE SHAPE OF THE POLYGON
            points.push(b.w + d.data.name.length * 7.5 + b.t + "," + (b.h / 2));
            points.push(b.w + d.data.name.length * 7.5 + "," + b.h);
            points.push("0," + b.h);
            if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
                points.push(b.t + "," + (b.h / 2));
            }
            return points.join(" ");
        }

        // Update the breadcrumb trail to show the current sequence and percentage.
        function updateBreadcrumbs(nodeArray, percentageString) {

            // Data join; key function combines name and depth (= position in sequence).
            let trail = d3.select("#trail")
                .selectAll("g")
                .data(nodeArray, function (d) { return d.data.name + d.depth; });

            // Remove exiting nodes.
            trail.exit().remove();

            // Add breadcrumb and label for entering nodes.
            let entering = trail.enter().append("svg:g");

            entering.append("svg:polygon")
                .attr("points", breadcrumbPoints)
                .style("fill", function (d) { return "#8BDBE9"; });

            entering.append("svg:text")
                .attr("x", (b.w + b.t) / 2)
                .attr("y", b.h / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .text(function (d) { return d.data.name; });

            // Now move and update the percentage at the end.
            let nodeAryFlat = "";

            for (let i = 0; i < nodeArray.length; i++) {
                nodeAryFlat = nodeAryFlat + " " + nodeArray[i].data.name
            }

            let nodeAryFlatLength = 0;
            let nodeAryFlatLengthPercentage = 0;
            for (let i = 1; i < nodeArray.length; i++) {
                nodeAryFlatLength = nodeAryFlatLength + b.w + nodeArray[i - 1].data.name.length * 7.5 + b.t
                nodeAryFlatLengthPercentage = nodeAryFlatLength + b.w + nodeArray[i].data.name.length * 7.5 + b.t + 15
            }

            entering.attr("transform", function (d, i) {
                if (i === 0) {
                    return "translate(0, 0)"
                } else {
                    return "translate(" + nodeAryFlatLength + ", 0)";   //POSITIONING OF WORDS
                }
            });

            //at the end of breadcrumbs, shows percentage of build
            d3.select("#trail").select("#endlabel")
                .attr("x", (nodeAryFlatLengthPercentage))  //CONTROLS WHERE THE PERCENTAGE IS LOCATED
                .attr("y", b.h / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "start")
                .text(percentageString);

            // Make the breadcrumb trail visible, if it's hidden.
            d3.select("#trail")
                .style("visibility", "");

        }

        // Take a 2-column CSV and transform it into a hierarchical structure suitable
        // for a partition layout. The first column is a sequence of step names, from
        // root to leaf, separated by hyphens. The second column is a count of how
        // often that sequence occurred.
        function buildHierarchy(csv) {
            let root = { "name": "root", "children": [] };
            for (let i = 0; i < csv.length; i++) {
                let sequence = csv[i][0];
                let size = +csv[i][1];
                if (isNaN(size)) { // e.g. if this is a header row
                    continue;
                }
                let parts = sequence.split("/");
                let currentNode = root;
                for (let j = 0; j < parts.length; j++) {
                    let children = currentNode["children"];
                    let nodeName = parts[j];
                    let childNode;
                    if (j + 1 < parts.length) {
                        // Not yet at the end of the sequence; move down the tree.
                        let foundChild = false;
                        for (let k = 0; k < children.length; k++) {
                            if (children[k]["name"] == nodeName) {
                                childNode = children[k];
                                foundChild = true;
                                break;
                            }
                        }
                        // If we don't already have a child node for this branch, create it.
                        if (!foundChild) {
                            childNode = { "name": nodeName, "children": [] };
                            children.push(childNode);
                        }
                        currentNode = childNode;
                    } else {
                        // Reached the end of the sequence; create a leaf node.
                        childNode = { "name": nodeName, "size": size };
                        children.push(childNode);
                    }
                }
            }
            return root;
        };

    } // end of drawChart()


    render() {
        return <React.Fragment>
            <div id="main">
                <div id="sequence"></div>
                <div id="chart" className="chart">

                    <svg width={630} height={500} className="#chart" ref={(elem) => { this.svg = elem; }} className="sunburst" />
                    {/*  Explanation: displayed in middle of sunburst */}
                    <div id="explanation" className="explanation">
                        <span id="filename"></span>
                        <br />
                        <span id="percentage"></span>
                        <br />
                        <div>
                            <span id="filesize"></span><br />
                        </div>
                    </div>
                </div>{/* end div.chart */}
            </div>
        </React.Fragment>
    }

}
