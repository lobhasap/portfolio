
var treeGeneration = 0;
var treeRequest = null;
var treeResizeHandler = null;
var treeResizeTimer = null;

function destroyTree() {
    treeGeneration += 1;
    if (treeResizeHandler) window.removeEventListener('resize', treeResizeHandler);
    treeResizeHandler = null;
    if (treeResizeTimer) window.clearTimeout(treeResizeTimer);
    treeResizeTimer = null;
    if (treeRequest && typeof treeRequest.abort === 'function') treeRequest.abort();
    treeRequest = null;
    if (typeof d3 !== 'undefined') d3.select("#tree-container").selectAll("*").remove();
}

function createTree() {
    destroyTree();
    var generation = treeGeneration;


    var dataUrl = new URL('interests.json', document.querySelector('base').href).toString();
    treeRequest = d3.json(dataUrl, function (error, treeData) {
        if (generation !== treeGeneration) return;
        treeRequest = null;
        if (error || !treeData) {
            d3.select("#tree-search-status").text("Could not load portfolio data");
            return;
        }

        // panning variables
        // Misc. variables
        var i = 0;
        var duration = 400;
        var root;
        var visibleNodes = [];
        var treeContainer = document.getElementById('tree-container');
        var viewerWidth = treeContainer.clientWidth || window.innerWidth;
        var viewerHeight = treeContainer.clientHeight || window.innerHeight;
        var LEVEL_SPACING = viewerWidth <= 600 ? Math.max(140, viewerWidth * 0.38) :
            viewerWidth <= 900 ? Math.max(190, viewerWidth * 0.42) : 300;
        var LABEL_LIMIT = viewerWidth <= 600 ? 28 : viewerWidth <= 900 ? 36 : 46;
        var NODE_FONT_SIZE = viewerWidth <= 600 ? 14 : viewerWidth <= 900 ? 12 : 11;
        var NODE_CHAR_WIDTH = NODE_FONT_SIZE * 0.62;
        var VIEW_TOP = 140;
        var VIEW_BOTTOM = 42;

        // Phones in portrait, plus short landscape windows (phones held
        // sideways, split-screen and short ultrawide windows). These need the
        // readable minimum zoom instead of a strict fit.
        function isCompactViewport() {
            return viewerWidth <= 600 || viewerHeight <= 520;
        }

        // size of the diagram
        treeResizeHandler = function () {
            viewerWidth = treeContainer.clientWidth || window.innerWidth;
            viewerHeight = treeContainer.clientHeight || window.innerHeight;
            LEVEL_SPACING = viewerWidth <= 600 ? Math.max(140, viewerWidth * 0.38) :
                viewerWidth <= 900 ? Math.max(190, viewerWidth * 0.42) : 300;
            LABEL_LIMIT = viewerWidth <= 600 ? 28 : viewerWidth <= 900 ? 36 : 46;
            NODE_FONT_SIZE = viewerWidth <= 600 ? 14 : viewerWidth <= 900 ? 12 : 11;
            NODE_CHAR_WIDTH = NODE_FONT_SIZE * 0.62;
            window.clearTimeout(treeResizeTimer);
            treeResizeTimer = window.setTimeout(function () {
                if (root) {
                    update(root);
                    fitTree(150, isCompactViewport() ? 0.72 : null);
                }
            }, 120);
        };
        window.addEventListener('resize', treeResizeHandler, { passive: true });

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

        // Wrap a label on word boundaries so long names stay readable instead
        // of being cut off with an ellipsis. Words longer than the limit are
        // split with a hyphen (e.g. long URLs or email addresses).
        function wrapLabel(text, limit) {
            var words = text.split(/\s+/);
            var lines = [];
            var current = "";

            words.forEach(function (word) {
                while (word.length > limit) {
                    if (current) {
                        lines.push(current);
                        current = "";
                    }
                    lines.push(word.substring(0, limit - 1) + "-");
                    word = word.substring(limit - 1);
                }
                if (!word) return;

                var candidate = current ? current + " " + word : word;
                if (candidate.length > limit && current) {
                    lines.push(current);
                    current = word;
                } else {
                    current = candidate;
                }
            });

            if (current) lines.push(current);
            return lines.length ? lines : [text];
        }

        function labelLines(d) {
            var lines = wrapLabel(d.name || "", LABEL_LIMIT);
            var count = d._children && d._children.length ? " (" + d._children.length + ")" : "";
            // Keep the child count attached to the last line instead of letting
            // it sit on a line of its own.
            lines[lines.length - 1] += count;
            return lines;
        }

        // Measure the rendered text instead of estimating from the character
        // count: proportional fonts make the estimate much wider than the
        // label really is, which would push the levels needlessly apart.
        var labelMeasureCanvas = null;
        function measureLabel(text, weight) {
            if (typeof document === "undefined") return text.length * NODE_CHAR_WIDTH;
            // Before the webfont is ready the fallback metrics are unreliable,
            // so keep the conservative character estimate until it loads.
            if (!document.fonts || document.fonts.status !== "loaded") {
                return text.length * NODE_CHAR_WIDTH;
            }
            if (!labelMeasureCanvas) labelMeasureCanvas = document.createElement("canvas");
            var context = labelMeasureCanvas.getContext ? labelMeasureCanvas.getContext("2d") : null;
            if (!context) return text.length * NODE_CHAR_WIDTH;
            context.font = weight + " " + NODE_FONT_SIZE + "px MyFont, sans-serif";
            return context.measureText(text).width;
        }

        function labelWidth(d) {
            var lines = labelLines(d);
            var weight = d.depth <= 1 || d.searchMatch ? "700" : "400";
            var longest = d3.max(lines, function (line) {
                return measureLabel(line, weight);
            }) || 0;
            return longest + 24;
        }

        function labelLineHeight() {
            return NODE_FONT_SIZE * 1.2;
        }

        // Height a node's label needs, including a little breathing room.
        function labelBoxHeight(d) {
            return Math.max(labelLines(d).length * labelLineHeight(), 22);
        }

        // Render the wrapped label as vertically centred <tspan> lines.
        function renderLabel(d) {
            var text = d3.select(this);
            var lines = labelLines(d);
            var lineHeightEm = 1.2;
            var firstDy = -((lines.length - 1) / 2) * lineHeightEm;

            while (this.firstChild) this.removeChild(this.firstChild);

            lines.forEach(function (line, index) {
                text.append("tspan")
                    .attr("x", text.attr("x"))
                    .attr("dy", (index === 0 ? firstDy : lineHeightEm) + "em")
                    .text(line);
            });
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
            var width = labelWidth(d);
            var height = labelBoxHeight(d) + 6;
            var hasChildren = d.children || d._children;
            return {
                minX: d.y - (hasChildren ? width : 20),
                maxX: d.y + (hasChildren ? 20 : width),
                minY: d.x - height / 2,
                maxY: d.x + height / 2
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

        function treeInsets() {
            var containerRect = treeContainer.getBoundingClientRect();
            var styles = window.getComputedStyle(treeContainer);
            var topInset = parseFloat(styles.getPropertyValue('--tree-top-inset')) || VIEW_TOP;
            var bottomInset = parseFloat(styles.getPropertyValue('--tree-bottom-inset')) || VIEW_BOTTOM;
            var margin = viewerWidth <= 600 ? 10 : 12;
            var wrapper = treeContainer.parentNode;
            var head = wrapper ? wrapper.querySelector(".page-head") : null;
            var toolbar = wrapper ? wrapper.querySelector(".tree-toolbar") : null;

            // Measure the real header/toolbar height instead of trusting only
            // the fixed CSS insets: on tall or narrow aspect ratios the
            // subtitle and hint wrap to different line counts.
            if (head) {
                topInset = Math.max(topInset, head.getBoundingClientRect().bottom - containerRect.top + margin);
            }
            if (toolbar) {
                var toolbarStyle = window.getComputedStyle(toolbar);
                var toolbarRect = toolbar.getBoundingClientRect();
                if (toolbarStyle.position === "absolute" || toolbarStyle.position === "fixed") {
                    bottomInset = Math.max(bottomInset, containerRect.bottom - toolbarRect.top + margin);
                } else {
                    topInset = Math.max(topInset, toolbarRect.bottom - containerRect.top + margin);
                }
            }

            treeContainer.style.clipPath = "inset(" + topInset + "px 0 " + bottomInset + "px 0)";
            return { top: topInset, bottom: bottomInset };
        }

        // Very tall portrait displays (rotated monitors and tall split-screen
        // windows) have room for a more legible tree. Landscape windows keep
        // the live desktop cap so their appearance is unchanged.
        function maxFitScale() {
            return viewerHeight >= 1600 && viewerHeight > viewerWidth ? 2.1 : 1.35;
        }

        function fitToBounds(bounds, animationDuration, minimumScale) {
            if (!bounds) return;

            var padding = viewerWidth <= 600 ? 20 : 40;
            var insets = treeInsets();
            var topInset = insets.top;
            var bottomInset = insets.bottom;
            var width = Math.max(bounds.maxX - bounds.minX, 1);
            var height = Math.max(bounds.maxY - bounds.minY, 1);
            var availableWidth = viewerWidth - padding * 2;
            var availableHeight = viewerHeight - topInset - bottomInset;
            var scale = Math.min(availableWidth / width, availableHeight / height, maxFitScale());

            // On phones a strict fit can shrink deep branches until the labels
            // are unreadable. Keep a usable zoom level and let the visitor pan.
            scale = Math.max(scale, minimumScale || 0.12);

            var translateX = (viewerWidth - width * scale) / 2 - bounds.minX * scale;
            var translateY = topInset + (availableHeight - height * scale) / 2 - bounds.minY * scale;
            var transform = "translate(" + translateX + "," + translateY + ")scale(" + scale + ")";

            if (animationDuration) {
                svgGroup.transition().duration(animationDuration).attr("transform", transform);
            } else {
                svgGroup.attr("transform", transform);
            }
            zoomListener.scale(scale).translate([translateX, translateY]);
        }

        function fitTree(animationDuration, minimumScale) {
            var bounds = null;
            visibleNodes.forEach(function (d) {
                bounds = extendBounds(bounds, nodeBounds(d));
            });
            fitToBounds(bounds, animationDuration, minimumScale);
        }

        function fitToNodes(nodes, animationDuration, minimumScale) {
            var bounds = null;
            nodes.forEach(function (d) {
                if (typeof d.x === "number" && typeof d.y === "number") {
                    bounds = extendBounds(bounds, nodeBounds(d));
                }
            });
            fitToBounds(bounds, animationDuration, minimumScale);
        }

        function fitBranch(node, animationDuration, minimumScale) {
            var branch = [root];
            (function collect(current) {
                branch.push(current);
                (current.children || []).forEach(collect);
            })(node);
            fitToNodes(branch, animationDuration, minimumScale);
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

            collapseAll(root);
            if (root._children) {
                root.children = root._children;
                root._children = null;
            }

            var matches = allNodes().filter(function (node) {
                return node.name.toLowerCase().indexOf(term) !== -1;
            });

            if (!matches.length) {
                update(root);
                fitTree(300);
                d3.select("#tree-search-status").text("no matches");
                return;
            }

            matches.forEach(function (node) {
                node.searchMatch = true;
                expandAncestors(node);
            });

            update(root);
            d3.select("#tree-search-status").text(matches.length + (matches.length === 1 ? " match" : " matches"));
            fitToNodes(matches, 300, isCompactViewport() ? 0.72 : null);
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
            .attr("role", "tree")
            .attr("aria-label", "About, experience, projects, and certifications")
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
            if (isCompactViewport() && d !== root) {
                fitBranch(d, duration, 0.72);
            } else {
                fitTree(duration, isCompactViewport() ? 0.72 : null);
            }
        }

        function update(source) {
            // Give every row the same pitch, sized for the tallest wrapped
            // label, so nodes at the same level are split evenly instead of
            // being packed by hand. d3's proportional sizing can squeeze rows
            // below the height of a two-line label, so use a fixed value.
            var visible = [];
            (function collect(n) {
                visible.push(n);
                (n.children || []).forEach(collect);
            })(root);
            var maxLines = d3.max(visible, function (d) {
                return labelLines(d).length;
            }) || 1;
            var rowHeight = Math.max(viewerWidth <= 600 ? 44 : 28, maxLines * labelLineHeight() + 6);

            tree = tree.nodeSize([rowHeight, 1]);

            // Compute the new tree layout.
            var nodes = tree.nodes(root).reverse(),
                links = tree.links(nodes);
            visibleNodes = nodes;

            var maxDepth = d3.max(nodes, function (d) {
                return d.depth;
            }) || 0;

            // A node with children ends its label on the node (it runs to the
            // left); a leaf starts its label on the node (it runs to the
            // right). Work out how far labels reach into the level before and
            // after them.
            var nodesByDepth = [];
            nodes.forEach(function (d) {
                var width = labelWidth(d);
                var hasChildren = d.children || d._children;
                d._extents = {
                    left: hasChildren ? width : 20,
                    right: hasChildren ? 20 : width
                };
                (nodesByDepth[d.depth] || (nodesByDepth[d.depth] = [])).push(d);
            });

            // Keep the levels evenly spaced unless a label from one level
            // would run into a label from the next. Only widen the gap between
            // two levels when their rows actually meet vertically, so the tree
            // stays compact instead of reserving room for the widest label at
            // every depth.
            var depthGap = [];
            var rowMargin = 2;
            var columnMargin = viewerWidth <= 600 ? 24 : 28;
            for (var level = 1; level <= maxDepth; level += 1) {
                depthGap[level] = LEVEL_SPACING;
                (nodesByDepth[level - 1] || []).forEach(function (outer) {
                    var outerHalf = labelBoxHeight(outer) / 2;
                    (nodesByDepth[level] || []).forEach(function (inner) {
                        var innerHalf = labelBoxHeight(inner) / 2;
                        var overlapY = Math.min(outer.x + outerHalf, inner.x + innerHalf) -
                            Math.max(outer.x - outerHalf, inner.x - innerHalf);
                        if (overlapY <= -rowMargin) return;
                        var needed = outer._extents.right + inner._extents.left + columnMargin;
                        depthGap[level] = Math.max(depthGap[level], needed);
                    });
                });
            }

            var depthY = [0];
            for (var depthIndex = 1; depthIndex <= maxDepth; depthIndex += 1) {
                depthY[depthIndex] = depthY[depthIndex - 1] + depthGap[depthIndex];
            }

            // Long labels wrap onto multiple lines; the full value is also
            // available in the node tooltip.
            nodes.forEach(function (d) {
                d.y = depthY[d.depth];
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
                .attr("role", "treeitem")
                .attr("tabindex", 0)
                .attr("aria-label", function (d) { return d.name; })
                .attr("aria-expanded", function (d) {
                    return d.children || d._children ? !!d.children : null;
                })
                .attr("transform", function (d) {
                    return "translate(" + source.y0 + "," + source.x0 + ")";
                })
                .on('click', click)
                .on('keydown', function (d) {
                    var event = d3.event;
                    if (event.keyCode !== 13 && event.keyCode !== 32) return;
                    event.preventDefault();
                    event.stopPropagation();
                    var hasChildren = d.children || d._children;
                    if (event.keyCode === 13 && d.url) {
                        window.open(d.url, "_blank", "noopener");
                    } else if (hasChildren) {
                        click(d);
                    } else if (d.url) {
                        window.open(d.url, "_blank", "noopener");
                    }
                });

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
                .each(renderLabel)
                .style("fill-opacity", 0)
                .style("fill", textColor)
                .style("font-weight", textWeight)
                .style("font-size", NODE_FONT_SIZE + "px")
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
                .each(renderLabel)
                .style("fill", textColor)
                .style("font-weight", textWeight)
                .style("font-size", NODE_FONT_SIZE + "px");

            node.attr("aria-label", function (d) { return d.name; })
                .attr("aria-expanded", function (d) {
                    return d.children || d._children ? !!d.children : null;
                });

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
