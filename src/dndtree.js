
function createTree() {


    treeJSON = d3.json('interests.json', function (treeData) {

        // panning variables
        var panSpeed = 200;
        var panBoundary = 20; // Within 20px from edges will pan when dragging.
        // Misc. variables
        var i = 0;
        var duration = 400;
        var root;
        var visibleNodes = [];
        var LEVEL_SPACING = 300;
        var LABEL_LIMIT = 46;
        var VIEW_TOP = 150;
        var VIEW_BOTTOM = 70;

        // size of the diagram

        var viewerWidth = $(window).width();
        var viewerHeight = $(window).height();
        var resizeTimer;
        $(window).resize(function () {
            viewerWidth = $(window).width();
            viewerHeight = $(window).height();
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                fitTree(150);
            }, 120);
        });

        var tree = d3.layout.tree()


        // define a d3 diagonal projection for use by the node paths later on.
        var diagonal = d3.svg.diagonal()
            .projection(function (d) {
                return [d.y, d.x];
            });

        // Give each top-level section its own colour and remember parent links
        // so search results can expand the correct path.
        var palette = ["#ffb703", "#4dabf7", "#51cf66", "#b197fc", "#ff6b9d", "#22d3ee", "#ff922b"];

        function applyColor(node, color) {
            node.color = color;
            (node.children || []).forEach(function (child) {
                applyColor(child, color);
            });
        }

        function setParents(node) {
            (node.children || []).forEach(function (child) {
                child.parent = node;
                setParents(child);
            });
        }

        (treeData.children || []).forEach(function (category, index) {
            applyColor(category, palette[index % palette.length]);
        });
        setParents(treeData);

        function displayName(d) {
            var count = d._children && d._children.length ? " (" + d._children.length + ")" : "";
            var limit = LABEL_LIMIT - count.length;
            var name = d.name;

            if (name.length > limit) {
                name = name.substring(0, limit - 3) + "...";
            }
            return name + count;
        }

        function textColor(d) {
            if (d.searchMatch) return "#ffd43b";
            if (d.depth === 0) return "#ffffff";
            if (d.depth === 1) return d.color || "#dddddd";
            return "#dddddd";
        }

        function textWeight(d) {
            return d.depth <= 1 || d.searchMatch ? "700" : "400";
        }

        function nodeRadius(d) {
            if (d.depth === 0) return 7;
            return d.children || d._children ? 5.5 : 3.5;
        }

        function nodeFill(d) {
            if (d._children) return d.color || "#dddddd";
            if (d.children) return "#111111";
            if (d.depth === 1) return d.color || "#dddddd";
            return "#dddddd";
        }

        function nodeStroke(d) {
            return d.color || "#dddddd";
        }

        function allNodes() {
            var result = [];
            (function walk(node) {
                result.push(node);
                (node.children || node._children || []).forEach(walk);
            })(root);
            return result;
        }

        function expandAncestors(node) {
            var parent = node.parent;
            while (parent) {
                if (parent._children) {
                    parent.children = parent._children;
                    parent._children = null;
                }
                parent = parent.parent;
            }
        }

        function nodeBounds(d) {
            var width = Math.min(displayName(d).length, LABEL_LIMIT) * 6.4 + 24;
            var hasChildren = d.children || d._children;
            return {
                minX: d.y - (hasChildren ? width : 20),
                maxX: d.y + (hasChildren ? 20 : width),
                minY: d.x - 18,
                maxY: d.x + 18
            };
        }

        function extendBounds(bounds, next) {
            if (!bounds) return next;
            bounds.minX = Math.min(bounds.minX, next.minX);
            bounds.maxX = Math.max(bounds.maxX, next.maxX);
            bounds.minY = Math.min(bounds.minY, next.minY);
            bounds.maxY = Math.max(bounds.maxY, next.maxY);
            return bounds;
        }

        function fitToBounds(bounds, animationDuration) {
            if (!bounds) return;

            var padding = 40;
            var bottomInset = window.innerWidth <= 820 ? 180 : VIEW_BOTTOM;
            var width = Math.max(bounds.maxX - bounds.minX, 1);
            var height = Math.max(bounds.maxY - bounds.minY, 1);
            var availableWidth = viewerWidth - padding * 2;
            var availableHeight = viewerHeight - VIEW_TOP - bottomInset;
            var scale = Math.min(availableWidth / width, availableHeight / height, 1.35);

            scale = Math.max(scale, 0.12);

            var translateX = (viewerWidth - width * scale) / 2 - bounds.minX * scale;
            var translateY = VIEW_TOP + (availableHeight - height * scale) / 2 - bounds.minY * scale;
            var transform = "translate(" + translateX + "," + translateY + ")scale(" + scale + ")";

            if (animationDuration) {
                svgGroup.transition().duration(animationDuration).attr("transform", transform);
            } else {
                svgGroup.attr("transform", transform);
            }
            zoomListener.scale(scale).translate([translateX, translateY]);
        }

        function fitTree(animationDuration) {
            var bounds = null;
            visibleNodes.forEach(function (d) {
                bounds = extendBounds(bounds, nodeBounds(d));
            });
            fitToBounds(bounds, animationDuration);
        }

        function fitToNodes(nodes, animationDuration) {
            var bounds = null;
            nodes.forEach(function (d) {
                if (typeof d.x === "number" && typeof d.y === "number") {
                    bounds = extendBounds(bounds, nodeBounds(d));
                }
            });
            fitToBounds(bounds, animationDuration);
        }

        function clearSearch() {
            allNodes().forEach(function (node) {
                node.searchMatch = false;
            });
            svgGroup.selectAll("g.node text")
                .style("fill", textColor)
                .style("font-weight", textWeight);
            d3.select("#tree-search-status").text("");
        }

        function runSearch(term) {
            term = (term || "").trim().toLowerCase();
            clearSearch();

            if (term.length < 2) return;

            var matches = allNodes().filter(function (node) {
                return node.name.toLowerCase().indexOf(term) !== -1;
            });

            if (!matches.length) {
                d3.select("#tree-search-status").text("no matches");
                return;
            }

            matches.forEach(function (node) {
                node.searchMatch = true;
                expandAncestors(node);
            });

            update(root);
            d3.select("#tree-search-status").text(matches.length + (matches.length === 1 ? " match" : " matches"));
            fitToNodes(matches, 300);
        }

        function resetView() {
            collapseAll(root);
            if (root._children) {
                root.children = root._children;
                root._children = null;
            }
            d3.select("#tree-search").property("value", "");
            update(root);
            clearSearch();
            fitTree(300);
        }

        // sort the tree according to the node names

        function sortTree() {
            tree.sort(function (a, b) {
                return b.name.toLowerCase() < a.name.toLowerCase() ? 1 : -1;
            });
        }
        // Sort the tree initially incase the JSON isn't in a sorted order.
        // sortTree();

        // TODO: Pan function, can be better implemented.

        function pan(domNode, direction) {
            var speed = panSpeed;
            if (panTimer) {
                clearTimeout(panTimer);
                translateCoords = d3.transform(svgGroup.attr("transform"));
                if (direction == 'left' || direction == 'right') {
                    translateX = direction == 'left' ? translateCoords.translate[0] + speed : translateCoords.translate[0] - speed;
                    translateY = translateCoords.translate[1];
                } else if (direction == 'up' || direction == 'down') {
                    translateX = translateCoords.translate[0];
                    translateY = direction == 'up' ? translateCoords.translate[1] + speed : translateCoords.translate[1] - speed;
                }
                scaleX = translateCoords.scale[0];
                scaleY = translateCoords.scale[1];
                scale = zoomListener.scale();
                svgGroup.transition().attr("transform", "translate(" + translateX + "," + translateY + ")scale(" + scale + ")");
                d3.select(domNode).select('g.node').attr("transform", "translate(" + translateX + "," + translateY + ")");
                zoomListener.scale(zoomListener.scale());
                zoomListener.translate([translateX, translateY]);
                panTimer = setTimeout(function () {
                    pan(domNode, speed, direction);
                }, 50);
            }
        }

        // Define the zoom function for the zoomable tree 
        function initialZoom() {
            // scale = 1.5
            // zoomListener.scale(1.5);
            // svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + scale + ")");

        }
        function zoom() {

            svgGroup.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        }


        // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
        var zoomListener = d3.behavior.zoom().scaleExtent([0.1, 3]).on("zoom", zoom);

        function initiateDrag(d, domNode) {
            draggingNode = d;
            d3.select(domNode).select('.ghostCircle').attr('pointer-events', 'none');
            d3.selectAll('.ghostCircle').attr('class', 'ghostCircle show');
            d3.select(domNode).attr('class', 'node activeDrag');

            svgGroup.selectAll("g.node").sort(function (a, b) { // select the parent and sort the path's
                if (a.id != draggingNode.id) return 1; // a is not the hovered element, send "a" to the back
                else return -1; // a is the hovered element, bring "a" to the front
            });
            // if nodes has children, remove the links and nodes
            if (nodes.length > 1) {
                // remove link paths
                links = tree.links(nodes);
                nodePaths = svgGroup.selectAll("path.link")
                    .data(links, function (d) {
                        return d.target.id;
                    }).remove();
                // remove child nodes
                nodesExit = svgGroup.selectAll("g.node")
                    .data(nodes, function (d) {
                        return d.id;
                    }).filter(function (d, i) {
                        if (d.id == draggingNode.id) {
                            return false;
                        }
                        return true;
                    }).remove();
            }

            // remove parent link
            parentLink = tree.links(tree.nodes(draggingNode.parent));
            svgGroup.selectAll('path.link').filter(function (d, i) {
                if (d.target.id == draggingNode.id) {
                    return true;
                }
                return false;
            }).remove();

            dragStarted = null;
        }

        // define the baseSvg, attaching a class for styling and the zoomListener
        var baseSvg = d3.select("#tree-container").append("svg")
            .attr("width", "100%")
            .attr("height", "100%")
            .attr("class", "overlay")
            .call(zoomListener);



        // Helper functions for collapsing and expanding nodes.

        function collapse(d) {
            if (d.children) {
                d._children = d.children;
                d._children.forEach(collapse);
                d.children = null;
            }
        }

        var overCircle = function (d) {
            selectedNode = d;
            updateTempConnector();
        };
        var outCircle = function (d) {
            selectedNode = null;
            updateTempConnector();
        };

        // Function to update the temporary connector indicating dragging affiliation
        var updateTempConnector = function () {
            var data = [];
            if (draggingNode !== null && selectedNode !== null) {
                // have to flip the source coordinates since we did this for the existing connectors on the original tree
                data = [{
                    source: {
                        x: selectedNode.y0,
                        y: selectedNode.x0
                    },
                    target: {
                        x: draggingNode.y0,
                        y: draggingNode.x0
                    }
                }];
            }
            var link = svgGroup.selectAll(".templink").data(data);

            link.enter().append("path")
                .attr("class", "templink")
                .attr("d", d3.svg.diagonal())
                .attr('pointer-events', 'none');

            link.attr("d", d3.svg.diagonal());

            link.exit().remove();
        };

        // Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.

        function collapseAll(d) {
            if (d.children) {
                d.children.forEach(collapseAll);
                collapse(d);
            }
        }
        function centerNode(source) {
            scale = zoomListener.scale();
            x = -source.y0;
            y = -source.x0;
            x = x * scale + viewerWidth / 2;
            y = y * scale + viewerHeight / 2;
            d3.select('g').transition()
                .duration(duration)
                .attr("transform", "translate(" + x + "," + y + ")scale(" + scale + ")");
            zoomListener.scale(scale);
            zoomListener.translate([x, y]);
        }

        // Toggle children function

        function toggleChildren(d) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else if (d._children) {
                d.children = d._children;
                d._children = null;
            }
            return d;
        }

        // Toggle children on click.

        function click(d) {
            if (d3.event && d3.event.defaultPrevented) return;
            if (!d.children && !d._children) return;

            d = toggleChildren(d);
            update(d);
            fitTree(duration);
        }

        function update(source) {
            // Compute the new height, function counts total children of root node and sets tree height accordingly.
            // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
            // This makes the layout more consistent.
            var levelWidth = [1];
            var childCount = function (level, n) {

                if (n.children && n.children.length > 0) {
                    if (levelWidth.length <= level + 1) levelWidth.push(0);

                    levelWidth[level + 1] += n.children.length;
                    n.children.forEach(function (d) {
                        childCount(level + 1, d);
                    });
                }
            };
            childCount(0, root);
            var newHeight = d3.max(levelWidth) * 28; // 28 pixels per line
            tree = tree.size([newHeight, viewerWidth]);

            // Compute the new tree layout.
            var nodes = tree.nodes(root).reverse(),
                links = tree.links(nodes);
            visibleNodes = nodes;

            // Keep a consistent level spacing. Labels are truncated for display
            // and the full value is available in the node tooltip.
            nodes.forEach(function (d) {
                d.y = d.depth * LEVEL_SPACING;
            });

            // Update the nodes…
            node = svgGroup.selectAll("g.node")
                .data(nodes, function (d) {
                    return d.id || (d.id = ++i);
                });

            // Enter any new nodes at the parent's previous position.
            var nodeEnter = node.enter().append("g")
                .attr("class", function (d) {
                    return d.url ? "node url-node" : "node";
                })
                .attr("transform", function (d) {
                    return "translate(" + source.y0 + "," + source.x0 + ")";
                })
                .on('click', click);

            nodeEnter.append("title").text(function (d) {
                return d.name;
            });

            nodeEnter.append("circle")
                .attr('class', 'nodeCircle')
                .attr("r", nodeRadius)
                .style("fill", nodeFill)
                .style("stroke", nodeStroke)
                .on("mouseover", function (d) {
                    d3.select(this).transition().duration(120).attr("r", nodeRadius(d) + 2.5);
                })
                .on("mouseout", function (d) {
                    d3.select(this).transition().duration(120).attr("r", nodeRadius(d));
                });

            nodeEnter.append("text")
                .attr("x", function (d) {
                    return d.children || d._children ? -10 : 10;
                })
                .attr("dy", ".35em")
                .attr("text-anchor", function (d) {
                    return d.children || d._children ? "end" : "start";
                })
                .text(displayName)
                .style("fill-opacity", 0)
                .style("fill", textColor)
                .style("font-weight", textWeight)
                .on("click", function (d) {
                    if (d.url) {
                        d3.event.stopPropagation();
                        window.open(d.url, "_blank", "noopener");
                    }
                })
                .on("mouseover", function (d) {
                    d3.select(this).style("fill", "#ffffff").style("font-weight", "700");
                })
                .on("mouseout", function (d) {
                    d3.select(this).style("fill", textColor(d)).style("font-weight", textWeight(d));
                });

            // phantom node to give us mouseover in a radius around it
            nodeEnter.append("circle")
                .attr('class', 'ghostCircle')
                .attr("r", 30)
                .attr("opacity", 0.2) // change this to zero to hide the target area
                .style("fill", "red")
                .attr('pointer-events', 'mouseover')
                .on("mouseover", function (node) {
                    overCircle(node);
                })
                .on("mouseout", function (node) {
                    outCircle(node);
                });

            // Update labels, colours and radii as nodes expand or collapse.
            node.select('text')
                .attr("x", function (d) {
                    return d.children || d._children ? -10 : 10;
                })
                .attr("text-anchor", function (d) {
                    return d.children || d._children ? "end" : "start";
                })
                .text(displayName)
                .style("fill", textColor)
                .style("font-weight", textWeight);

            node.select("circle.nodeCircle")
                .attr("r", nodeRadius)
                .style("fill", nodeFill)
                .style("stroke", nodeStroke);

            // Transition nodes to their new position.
            var nodeUpdate = node.transition()
                .duration(duration)
                .attr("transform", function (d) {
                    return "translate(" + d.y + "," + d.x + ")";
                });

            // Fade the text in
            nodeUpdate.select("text")
                .style("fill-opacity", 1);

            // Transition exiting nodes to the parent's new position.
            var nodeExit = node.exit().transition()
                .duration(duration)
                .attr("transform", function (d) {
                    return "translate(" + source.y + "," + source.x + ")";
                })
                .remove();

            nodeExit.select("circle")
                .attr("r", 0);

            nodeExit.select("text")
                .style("fill-opacity", 0);

            // Update the links…
            var link = svgGroup.selectAll("path.link")
                .data(links, function (d) {
                    return d.target.id;
                });

            // Enter any new links at the parent's previous position.
            link.enter().insert("path", "g")
                .attr("class", "link")
                .style("stroke", function (d) {
                    return d.target.color || "#cccccc";
                })
                .attr("d", function (d) {
                    var o = {
                        x: source.x0,
                        y: source.y0
                    };
                    return diagonal({
                        source: o,
                        target: o
                    });
                });

            link.style("stroke", function (d) {
                return d.target.color || "#cccccc";
            });

            // Transition links to their new position.
            link.transition()
                .duration(duration)
                .attr("d", diagonal);

            // Transition exiting nodes to the parent's new position.
            link.exit().transition()
                .duration(duration)
                .attr("d", function (d) {
                    var o = {
                        x: source.x,
                        y: source.y
                    };
                    return diagonal({
                        source: o,
                        target: o
                    });
                })
                .remove();

            // Stash the old positions for transition.
            nodes.forEach(function (d) {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        // Append a group which holds all nodes and which the zoom Listener can act upon.
        var svgGroup = baseSvg.append("g");

        // Define the root
        root = treeData;
        root.x0 = viewerHeight / 2;
        root.y0 = 0;

        // Start with the top-level sections visible so the portfolio has an
        // immediate overview, then let the visitor drill down.
        collapseAll(root);
        if (root._children) {
            root.children = root._children;
            root._children = null;
        }

        update(root);
        fitTree(0);

        d3.select("#tree-search").on("input", function () {
            runSearch(this.value);
        });
        d3.select("#tree-fit").on("click", function () {
            fitTree(300);
        });
        d3.select("#tree-reset").on("click", resetView);
    });
}