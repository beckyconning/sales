(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":9}],3:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":25}],4:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"min-document":1}],5:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],6:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],7:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":12}],8:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":16,"is-object":5}],9:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":14,"../vnode/is-vnode.js":17,"../vnode/is-vtext.js":18,"../vnode/is-widget.js":19,"./apply-properties":8,"global/document":4}],10:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],11:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var render = require("./create-element")
var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":19,"../vnode/vpatch.js":22,"./apply-properties":8,"./create-element":9,"./update-widget":13}],12:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches) {
    return patchRecursive(rootNode, patches)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions) {
        renderOptions = { patch: patchRecursive }
        if (ownerDocument !== document) {
            renderOptions.document = ownerDocument
        }
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./dom-index":10,"./patch-op":11,"global/document":4,"x-is-array":6}],13:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":19}],14:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":15,"./is-vnode":17,"./is-vtext":18,"./is-widget":19}],15:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],16:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],17:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":20}],18:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":20}],19:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],20:[function(require,module,exports){
module.exports = "2"

},{}],21:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":15,"./is-vhook":16,"./is-vnode":17,"./is-widget":19,"./version":20}],22:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":20}],23:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":20}],24:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":16,"is-object":5}],25:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free,     // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":14,"../vnode/is-thunk":15,"../vnode/is-vnode":17,"../vnode/is-vtext":18,"../vnode/is-widget":19,"../vnode/vpatch":22,"./diff-props":24,"x-is-array":6}],26:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Alt = function ($less$bar$greater, __superclass_Prelude$dotFunctor_0) {
    this["<|>"] = $less$bar$greater;
    this["__superclass_Prelude.Functor_0"] = __superclass_Prelude$dotFunctor_0;
};
var $less$bar$greater = function (dict) {
    return dict["<|>"];
};
module.exports = {
    Alt: Alt, 
    "<|>": $less$bar$greater
};

},{"Prelude":130}],27:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Lazy = require("Control.Lazy");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Alternative = function (__superclass_Control$dotPlus$dotPlus_1, __superclass_Prelude$dotApplicative_0) {
    this["__superclass_Control.Plus.Plus_1"] = __superclass_Control$dotPlus$dotPlus_1;
    this["__superclass_Prelude.Applicative_0"] = __superclass_Prelude$dotApplicative_0;
};
var some = function (__dict_Alternative_0) {
    return function (__dict_Lazy1_1) {
        return function (v) {
            return Prelude["<*>"]((__dict_Alternative_0["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())(Prelude["<$>"](((__dict_Alternative_0["__superclass_Control.Plus.Plus_1"]())["__superclass_Control.Alt.Alt_0"]())["__superclass_Prelude.Functor_0"]())(Prelude[":"])(v))(Control_Lazy.defer1(__dict_Lazy1_1)(function (_120) {
                return many(__dict_Alternative_0)(__dict_Lazy1_1)(v);
            }));
        };
    };
};
var many = function (__dict_Alternative_2) {
    return function (__dict_Lazy1_3) {
        return function (v) {
            return Control_Alt["<|>"]((__dict_Alternative_2["__superclass_Control.Plus.Plus_1"]())["__superclass_Control.Alt.Alt_0"]())(some(__dict_Alternative_2)(__dict_Lazy1_3)(v))(Prelude.pure(__dict_Alternative_2["__superclass_Prelude.Applicative_0"]())([  ]));
        };
    };
};
module.exports = {
    Alternative: Alternative, 
    many: many, 
    some: some
};

},{"Control.Alt":26,"Control.Lazy":33,"Control.Plus":58,"Prelude":130}],28:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var $less$times = function (__dict_Apply_0) {
    return function (a) {
        return function (b) {
            return Prelude["<*>"](__dict_Apply_0)(Prelude["<$>"](__dict_Apply_0["__superclass_Prelude.Functor_0"]())(Prelude["const"])(a))(b);
        };
    };
};
var $times$greater = function (__dict_Apply_1) {
    return function (a) {
        return function (b) {
            return Prelude["<*>"](__dict_Apply_1)(Prelude["<$>"](__dict_Apply_1["__superclass_Prelude.Functor_0"]())(Prelude["const"](Prelude.id(Prelude.categoryArr)))(a))(b);
        };
    };
};
var lift5 = function (__dict_Apply_2) {
    return function (f) {
        return function (a) {
            return function (b) {
                return function (c) {
                    return function (d) {
                        return function (e) {
                            return Prelude["<*>"](__dict_Apply_2)(Prelude["<*>"](__dict_Apply_2)(Prelude["<*>"](__dict_Apply_2)(Prelude["<*>"](__dict_Apply_2)(Prelude["<$>"](__dict_Apply_2["__superclass_Prelude.Functor_0"]())(f)(a))(b))(c))(d))(e);
                        };
                    };
                };
            };
        };
    };
};
var lift4 = function (__dict_Apply_3) {
    return function (f) {
        return function (a) {
            return function (b) {
                return function (c) {
                    return function (d) {
                        return Prelude["<*>"](__dict_Apply_3)(Prelude["<*>"](__dict_Apply_3)(Prelude["<*>"](__dict_Apply_3)(Prelude["<$>"](__dict_Apply_3["__superclass_Prelude.Functor_0"]())(f)(a))(b))(c))(d);
                    };
                };
            };
        };
    };
};
var lift3 = function (__dict_Apply_4) {
    return function (f) {
        return function (a) {
            return function (b) {
                return function (c) {
                    return Prelude["<*>"](__dict_Apply_4)(Prelude["<*>"](__dict_Apply_4)(Prelude["<$>"](__dict_Apply_4["__superclass_Prelude.Functor_0"]())(f)(a))(b))(c);
                };
            };
        };
    };
};
var lift2 = function (__dict_Apply_5) {
    return function (f) {
        return function (a) {
            return function (b) {
                return Prelude["<*>"](__dict_Apply_5)(Prelude["<$>"](__dict_Apply_5["__superclass_Prelude.Functor_0"]())(f)(a))(b);
            };
        };
    };
};
module.exports = {
    lift5: lift5, 
    lift4: lift4, 
    lift3: lift3, 
    lift2: lift2, 
    "*>": $times$greater, 
    "<*": $less$times
};

},{"Prelude":130}],29:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var $greater$eq$greater = function (__dict_Bind_0) {
    return function (f) {
        return function (g) {
            return function (a) {
                return Prelude[">>="](__dict_Bind_0)(f(a))(g);
            };
        };
    };
};
var $eq$less$less = function (__dict_Bind_1) {
    return function (f) {
        return function (m) {
            return Prelude[">>="](__dict_Bind_1)(m)(f);
        };
    };
};
var $less$eq$less = function (__dict_Bind_2) {
    return function (f) {
        return function (g) {
            return function (a) {
                return $eq$less$less(__dict_Bind_2)(f)(g(a));
            };
        };
    };
};
var join = function (__dict_Bind_3) {
    return function (m) {
        return Prelude[">>="](__dict_Bind_3)(m)(Prelude.id(Prelude.categoryArr));
    };
};
var ifM = function (__dict_Bind_4) {
    return function (cond) {
        return function (t) {
            return function (f) {
                return Prelude[">>="](__dict_Bind_4)(cond)(function (cond$prime) {
                    if (cond$prime) {
                        return t;
                    };
                    if (!cond$prime) {
                        return f;
                    };
                    throw new Error("Failed pattern match");
                });
            };
        };
    };
};
module.exports = {
    ifM: ifM, 
    join: join, 
    "<=<": $less$eq$less, 
    ">=>": $greater$eq$greater, 
    "=<<": $eq$less$less
};

},{"Prelude":130}],30:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Extend = require("Control.Extend");
var Comonad = function (__superclass_Control$dotExtend$dotExtend_0, extract) {
    this["__superclass_Control.Extend.Extend_0"] = __superclass_Control$dotExtend$dotExtend_0;
    this.extract = extract;
};
var extract = function (dict) {
    return dict.extract;
};
module.exports = {
    Comonad: Comonad, 
    extract: extract
};

},{"Control.Extend":31,"Prelude":130}],31:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Extend = function ($less$less$eq, __superclass_Prelude$dotFunctor_0) {
    this["<<="] = $less$less$eq;
    this["__superclass_Prelude.Functor_0"] = __superclass_Prelude$dotFunctor_0;
};
var $less$less$eq = function (dict) {
    return dict["<<="];
};
var $eq$less$eq = function (__dict_Extend_0) {
    return function (f) {
        return function (g) {
            return function (w) {
                return f($less$less$eq(__dict_Extend_0)(g)(w));
            };
        };
    };
};
var $eq$greater$eq = function (__dict_Extend_1) {
    return function (f) {
        return function (g) {
            return function (w) {
                return g($less$less$eq(__dict_Extend_1)(f)(w));
            };
        };
    };
};
var $eq$greater$greater = function (__dict_Extend_2) {
    return function (w) {
        return function (f) {
            return $less$less$eq(__dict_Extend_2)(f)(w);
        };
    };
};
var extendArr = function (__dict_Semigroup_3) {
    return new Extend(function (f) {
        return function (g) {
            return function (w) {
                return f(function (w$prime) {
                    return g(Prelude["<>"](__dict_Semigroup_3)(w)(w$prime));
                });
            };
        };
    }, function () {
        return Prelude.functorArr;
    });
};
var extend = function (__dict_Extend_4) {
    return $less$less$eq(__dict_Extend_4);
};
var duplicate = function (__dict_Extend_5) {
    return function (w) {
        return $less$less$eq(__dict_Extend_5)(Prelude.id(Prelude.categoryArr))(w);
    };
};
module.exports = {
    Extend: Extend, 
    duplicate: duplicate, 
    extend: extend, 
    "=<=": $eq$less$eq, 
    "=>=": $eq$greater$eq, 
    "=>>": $eq$greater$greater, 
    "<<=": $less$less$eq, 
    extendArr: extendArr
};

},{"Prelude":130}],32:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var $less$dollar = function (__dict_Functor_0) {
    return function (x) {
        return function (f) {
            return Prelude["<$>"](__dict_Functor_0)(Prelude["const"](x))(f);
        };
    };
};
var $dollar$greater = function (__dict_Functor_1) {
    return function (f) {
        return function (x) {
            return Prelude["<$>"](__dict_Functor_1)(Prelude["const"](x))(f);
        };
    };
};
module.exports = {
    "$>": $dollar$greater, 
    "<$": $less$dollar
};

},{"Prelude":130}],33:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Lazy = function (defer) {
    this.defer = defer;
};
var Lazy1 = function (defer1) {
    this.defer1 = defer1;
};
var Lazy2 = function (defer2) {
    this.defer2 = defer2;
};
var defer2 = function (dict) {
    return dict.defer2;
};
var fix2 = function (__dict_Lazy2_0) {
    return function (f) {
        return defer2(__dict_Lazy2_0)(function (_113) {
            return f(fix2(__dict_Lazy2_0)(f));
        });
    };
};
var defer1 = function (dict) {
    return dict.defer1;
};
var fix1 = function (__dict_Lazy1_1) {
    return function (f) {
        return defer1(__dict_Lazy1_1)(function (_112) {
            return f(fix1(__dict_Lazy1_1)(f));
        });
    };
};
var defer = function (dict) {
    return dict.defer;
};
var fix = function (__dict_Lazy_2) {
    return function (f) {
        return defer(__dict_Lazy_2)(function (_111) {
            return f(fix(__dict_Lazy_2)(f));
        });
    };
};
module.exports = {
    Lazy2: Lazy2, 
    Lazy1: Lazy1, 
    Lazy: Lazy, 
    fix2: fix2, 
    fix1: fix1, 
    fix: fix, 
    defer2: defer2, 
    defer1: defer1, 
    defer: defer
};

},{"Prelude":130}],34:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Aff = require("Control.Monad.Aff");
var MonadAff = function (liftAff) {
    this.liftAff = liftAff;
};
var monadAffAff = new MonadAff(Prelude.id(Prelude.categoryArr));
var liftAff = function (dict) {
    return dict.liftAff;
};
module.exports = {
    MonadAff: MonadAff, 
    liftAff: liftAff, 
    monadAffAff: monadAffAff
};

},{"Control.Monad.Aff":35,"Prelude":130}],35:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Function = require("Data.Function");
var Data_Monoid = require("Data.Monoid");
var Data_Either = require("Data.Either");
var Control_Monad_Error_Class = require("Control.Monad.Error.Class");
var Control_Monad_Eff_Exception = require("Control.Monad.Eff.Exception");
var Control_Apply = require("Control.Apply");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var Control_MonadPlus = require("Control.MonadPlus");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Control_Monad_Eff_Unsafe = require("Control.Monad.Eff.Unsafe");
var Control_Monad_Eff_Class = require("Control.Monad.Eff.Class");

    function _setTimeout(nonCanceler, millis, aff) {
      return function(success, error) {
        var canceler;
        var cancel = false;

        var timeout = setTimeout(function() {
          if (!cancel) {
            canceler = aff(success, error);
          }
        }, millis);

        return function(e) {
          return function(success, error) {
            if (canceler !== undefined) {
              return canceler(e)(success, error);
            } else {
              cancel = true;

              clearTimeout(timeout);

              try {
                success(true);
              } catch (e) {
                error(e);
              }

              return nonCanceler;
            }
          };
        };
      };
    }
  ;

    function _unsafeInterleaveAff(aff) {
      return aff;
    }
  ;

    function _forkAff(canceler, aff) {
      return function(success, error) {
        var canceler = aff(function(){}, function(){});

        try {
          success(canceler);
        } catch (e) {
          error(e);
        }

        return canceler;
      };
    }
  ;

    function _makeAff(cb) {
      return function(success, error) {
        return cb(function(e) {
          return function() {
            error(e);
          };
        })(function(v) {
          return function() {
            try {
              success(v);
            } catch (e) {
              error(e);
            }
          };
        })();
      }
    }
    ;

    function _pure(canceler, v) {
      return function(success, error) {
        try {
          success(v);
        } catch (e) {
          error(e);
        }

        return canceler;
      }
    };

    function _throwError(canceler, e) {
      return function(success, error) {
        error(e);

        return canceler;
      }
    };

    function _fmap(f, aff) {
      return function(success, error) {
        return aff(function(v) {
          try {
            success(f(v));
          } catch (e) {
            error(e);
          }
        }, error);
      };
    };

    function _bind(aff, f) {
      return function(success, error) {
        var canceler;

        canceler = aff(function(v) {
          try {
            canceler = f(v)(success, error);
          } catch (e) {
            error(e);
          }
        }, error);

        return function(e) {
          return function(success, error) {
            return canceler(e)(success, error);
          }
        };
      };
    };

    function _attempt(Left, Right, aff) {
      return function(success, error) {
        return aff(function(v) {
          try {
            success(Right(v));
          } catch (e) {
            error(e);
          }
        }, function(e) {
          try {
            success(Left(e));
          } catch (e) {
            error(e);
          }
        });
      };
    };

    function _runAff(errorT, successT, aff) {
      return function() {
        return aff(function(v) {
          try {
            successT(v)();
          } catch (e) {
            errorT(e)();
          }
        }, function(e) {
          errorT(e)();
        });
      };
    };

    function _liftEff(canceler, e) {
      return function(success, error) {
        try {
          success(e());
        } catch (e) {
          error(e);
        }

        return canceler;
      };
    };
var runAff = function (ex) {
    return function (f) {
        return function (aff) {
            return _runAff(ex, f, aff);
        };
    };
};
var makeAff$prime = function (h) {
    return _makeAff(h);
};
var launchAff = runAff(Prelude["const"](Prelude.pure(Control_Monad_Eff.applicativeEff)(Prelude.unit)))(Prelude["const"](Prelude.pure(Control_Monad_Eff.applicativeEff)(Prelude.unit)));
var functorAff = new Prelude.Functor(function (f) {
    return function (fa) {
        return _fmap(f, fa);
    };
});
var attempt = function (aff) {
    return _attempt(Data_Either.Left.create, Data_Either.Right.create, aff);
};
var applyAff = new Prelude.Apply(function (ff) {
    return function (fa) {
        return _bind(ff, function (f) {
            return Prelude["<$>"](functorAff)(f)(fa);
        });
    };
}, function () {
    return functorAff;
});
var bindAff = new Prelude.Bind(function (fa) {
    return function (f) {
        return _bind(fa, f);
    };
}, function () {
    return applyAff;
});
var semigroupAff = function (__dict_Semigroup_0) {
    return new Prelude.Semigroup(function (a) {
        return function (b) {
            return Prelude["<*>"](applyAff)(Prelude["<$>"](functorAff)(Prelude["<>"](__dict_Semigroup_0))(a))(b);
        };
    });
};
var applicativeAff = new Prelude.Applicative(function () {
    return applyAff;
}, function (v) {
    return _pure(nonCanceler, v);
});
var nonCanceler = Prelude["const"](Prelude.pure(applicativeAff)(false));
var monadAff = new Prelude.Monad(function () {
    return applicativeAff;
}, function () {
    return bindAff;
});
var monoidAff = function (__dict_Monoid_1) {
    return new Data_Monoid.Monoid(function () {
        return semigroupAff(__dict_Monoid_1["__superclass_Prelude.Semigroup_0"]());
    }, Prelude.pure(applicativeAff)(Data_Monoid.mempty(__dict_Monoid_1)));
};
var forkAff = function (aff) {
    return _forkAff(nonCanceler, aff);
};
var later$prime = function (n) {
    return function (aff) {
        return _setTimeout(nonCanceler, n, aff);
    };
};
var later = later$prime(0);
var liftEff$prime = function (eff) {
    return attempt(_unsafeInterleaveAff(_liftEff(nonCanceler, eff)));
};
var makeAff = function (h) {
    return makeAff$prime(function (e) {
        return function (a) {
            return Prelude["<$>"](Control_Monad_Eff.functorEff)(Prelude["const"](nonCanceler))(h(e)(a));
        };
    });
};
var monadEffAff = new Control_Monad_Eff_Class.MonadEff(function () {
    return monadAff;
}, function (eff) {
    return _liftEff(nonCanceler, eff);
});
var monadErrorAff = new Control_Monad_Error_Class.MonadError(function (aff) {
    return function (ex) {
        return Prelude[">>="](bindAff)(attempt(aff))(Data_Either.either(ex)(Prelude.pure(applicativeAff)));
    };
}, function (e) {
    return _throwError(nonCanceler, e);
});
var apathize = function (a) {
    return Prelude["<$>"](functorAff)(Prelude["const"](Prelude.unit))(attempt(a));
};
var altAff = new Control_Alt.Alt(function (a1) {
    return function (a2) {
        return Prelude[">>="](bindAff)(attempt(a1))(Data_Either.either(Prelude["const"](a2))(Prelude.pure(applicativeAff)));
    };
}, function () {
    return functorAff;
});
var plusAff = new Control_Plus.Plus(function () {
    return altAff;
}, Control_Monad_Error_Class.throwError(monadErrorAff)(Control_Monad_Eff_Exception.error("Always fails")));
var alternativeAff = new Control_Alternative.Alternative(function () {
    return plusAff;
}, function () {
    return applicativeAff;
});
var monadPlusAff = new Control_MonadPlus.MonadPlus(function () {
    return alternativeAff;
}, function () {
    return monadAff;
});
module.exports = {
    runAff: runAff, 
    nonCanceler: nonCanceler, 
    "makeAff'": makeAff$prime, 
    makeAff: makeAff, 
    "liftEff'": liftEff$prime, 
    launchAff: launchAff, 
    "later'": later$prime, 
    later: later, 
    forkAff: forkAff, 
    attempt: attempt, 
    apathize: apathize, 
    semigroupAff: semigroupAff, 
    monoidAff: monoidAff, 
    functorAff: functorAff, 
    applyAff: applyAff, 
    applicativeAff: applicativeAff, 
    bindAff: bindAff, 
    monadAff: monadAff, 
    monadEffAff: monadEffAff, 
    monadErrorAff: monadErrorAff, 
    altAff: altAff, 
    plusAff: plusAff, 
    alternativeAff: alternativeAff, 
    monadPlusAff: monadPlusAff
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Apply":28,"Control.Monad.Eff":40,"Control.Monad.Eff.Class":36,"Control.Monad.Eff.Exception":37,"Control.Monad.Eff.Unsafe":39,"Control.Monad.Error.Class":41,"Control.MonadPlus":57,"Control.Plus":58,"Data.Either":74,"Data.Function":83,"Data.Monoid":96,"Prelude":130}],36:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Data_Monoid = require("Data.Monoid");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Control_Monad_Maybe_Trans = require("Control.Monad.Maybe.Trans");
var Control_Monad_Error_Trans = require("Control.Monad.Error.Trans");
var Control_Monad_State_Trans = require("Control.Monad.State.Trans");
var Control_Monad_Writer_Trans = require("Control.Monad.Writer.Trans");
var Control_Monad_Reader_Trans = require("Control.Monad.Reader.Trans");
var Control_Monad_RWS_Trans = require("Control.Monad.RWS.Trans");
var MonadEff = function (__superclass_Prelude$dotMonad_0, liftEff) {
    this["__superclass_Prelude.Monad_0"] = __superclass_Prelude$dotMonad_0;
    this.liftEff = liftEff;
};
var monadEffEff = new MonadEff(function () {
    return Control_Monad_Eff.monadEff;
}, Prelude.id(Prelude.categoryArr));
var liftEff = function (dict) {
    return dict.liftEff;
};
var monadEffError = function (__dict_Monad_0) {
    return function (__dict_MonadEff_1) {
        return new MonadEff(function () {
            return Control_Monad_Error_Trans.monadErrorT(__dict_Monad_0);
        }, Prelude["<<<"](Prelude.semigroupoidArr)(Control_Monad_Trans.lift(Control_Monad_Error_Trans.monadTransErrorT)(__dict_Monad_0))(liftEff(__dict_MonadEff_1)));
    };
};
var monadEffMaybe = function (__dict_Monad_2) {
    return function (__dict_MonadEff_3) {
        return new MonadEff(function () {
            return Control_Monad_Maybe_Trans.monadMaybeT(__dict_Monad_2);
        }, Prelude["<<<"](Prelude.semigroupoidArr)(Control_Monad_Trans.lift(Control_Monad_Maybe_Trans.monadTransMaybeT)(__dict_Monad_2))(liftEff(__dict_MonadEff_3)));
    };
};
var monadEffRWS = function (__dict_Monad_4) {
    return function (__dict_Monoid_5) {
        return function (__dict_MonadEff_6) {
            return new MonadEff(function () {
                return Control_Monad_RWS_Trans.monadRWST(__dict_Monad_4)(__dict_Monoid_5);
            }, Prelude["<<<"](Prelude.semigroupoidArr)(Control_Monad_Trans.lift(Control_Monad_RWS_Trans.monadTransRWST(__dict_Monoid_5))(__dict_Monad_4))(liftEff(__dict_MonadEff_6)));
        };
    };
};
var monadEffReader = function (__dict_Monad_7) {
    return function (__dict_MonadEff_8) {
        return new MonadEff(function () {
            return Control_Monad_Reader_Trans.monadReaderT(__dict_Monad_7);
        }, Prelude["<<<"](Prelude.semigroupoidArr)(Control_Monad_Trans.lift(Control_Monad_Reader_Trans.monadTransReaderT)(__dict_Monad_7))(liftEff(__dict_MonadEff_8)));
    };
};
var monadEffState = function (__dict_Monad_9) {
    return function (__dict_MonadEff_10) {
        return new MonadEff(function () {
            return Control_Monad_State_Trans.monadStateT(__dict_Monad_9);
        }, Prelude["<<<"](Prelude.semigroupoidArr)(Control_Monad_Trans.lift(Control_Monad_State_Trans.monadTransStateT)(__dict_Monad_9))(liftEff(__dict_MonadEff_10)));
    };
};
var monadEffWriter = function (__dict_Monad_11) {
    return function (__dict_Monoid_12) {
        return function (__dict_MonadEff_13) {
            return new MonadEff(function () {
                return Control_Monad_Writer_Trans.monadWriterT(__dict_Monoid_12)(__dict_Monad_11);
            }, Prelude["<<<"](Prelude.semigroupoidArr)(Control_Monad_Trans.lift(Control_Monad_Writer_Trans.monadTransWriterT(__dict_Monoid_12))(__dict_Monad_11))(liftEff(__dict_MonadEff_13)));
        };
    };
};
module.exports = {
    MonadEff: MonadEff, 
    liftEff: liftEff, 
    monadEffEff: monadEffEff, 
    monadEffMaybe: monadEffMaybe, 
    monadEffError: monadEffError, 
    monadEffState: monadEffState, 
    monadEffWriter: monadEffWriter, 
    monadEffReader: monadEffReader, 
    monadEffRWS: monadEffRWS
};

},{"Control.Monad.Eff":40,"Control.Monad.Error.Trans":42,"Control.Monad.Maybe.Trans":46,"Control.Monad.RWS.Trans":47,"Control.Monad.Reader.Trans":49,"Control.Monad.State.Trans":51,"Control.Monad.Trans":52,"Control.Monad.Writer.Trans":54,"Data.Monoid":96,"Prelude":130}],37:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Eff = require("Control.Monad.Eff");

  function showErrorImpl(err) {
    return err.stack || err.toString();
  }
  ;

  function error(msg) {
    return new Error(msg);
  }
  ;

  function message(e) {
    return e.message;
  }
  ;

  function throwException(e) {
    return function() {
      throw e;
    };
  }
  ;

  function catchException(c) {
    return function(t) {
      return function() {
        try {
          return t();
        } catch(e) {
          if (e instanceof Error || Object.prototype.toString.call(e) === '[object Error]') {
            return c(e)();
          } else {
            return c(new Error(e.toString()))();
          }
        }
      };
    };
  }
  ;
var showError = new Prelude.Show(showErrorImpl);
module.exports = {
    catchException: catchException, 
    throwException: throwException, 
    message: message, 
    error: error, 
    showError: showError
};

},{"Control.Monad.Eff":40,"Prelude":130}],38:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Eff = require("Control.Monad.Eff");

  function newRef(val) {
    return function () {
      return { value: val };
    };
  }
;

  function readRef(ref) {
    return function() {
      return ref.value;
    };
  }
;

  function modifyRef$prime(ref) {
    return function(f) {
      return function() {
        var t = f(ref.value);
        ref.value = t.newState;
        return t.retVal;
      };
    };
  }
;

  function writeRef(ref) {
    return function(val) {
      return function() {
        ref.value = val;
        return {};
      };
    };
  }
;
var modifyRef = function (ref) {
    return function (f) {
        return modifyRef$prime(ref)(function (s) {
            return {
                newState: f(s), 
                retVal: Prelude.unit
            };
        });
    };
};
module.exports = {
    writeRef: writeRef, 
    modifyRef: modifyRef, 
    "modifyRef'": modifyRef$prime, 
    readRef: readRef, 
    newRef: newRef
};

},{"Control.Monad.Eff":40,"Prelude":130}],39:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Eff = require("Control.Monad.Eff");

    function unsafeInterleaveEff(f) {
      return f;
    }
    ;
module.exports = {
    unsafeInterleaveEff: unsafeInterleaveEff
};

},{"Control.Monad.Eff":40,"Prelude":130}],40:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");

    function returnE(a) {
      return function() {
        return a;
      };
    }
    ;

    function bindE(a) {
      return function(f) {
        return function() {
          return f(a())();
        };
      };
    }
    ;

    function runPure(f) {
      return f();
    }
    ;

    function untilE(f) {
      return function() {
        while (!f());
        return {};
      };
    }
    ;

    function whileE(f) {
      return function(a) {
        return function() {
          while (f()) {
            a();
          }
          return {};
        };
      };
    }
    ;

    function forE(lo) {
      return function(hi) {
        return function(f) {
          return function() {
            for (var i = lo; i < hi; i++) {
              f(i)();
            }
          };
        };
      };
    }
    ;

    function foreachE(as) {
      return function(f) {
        return function() {
          for (var i = 0; i < as.length; i++) {
            f(as[i])();
          }
        };
      };
    }
    ;
var monadEff = new Prelude.Monad(function () {
    return applicativeEff;
}, function () {
    return bindEff;
});
var bindEff = new Prelude.Bind(bindE, function () {
    return applyEff;
});
var applyEff = new Prelude.Apply(Prelude.ap(monadEff), function () {
    return functorEff;
});
var applicativeEff = new Prelude.Applicative(function () {
    return applyEff;
}, returnE);
var functorEff = new Prelude.Functor(Prelude.liftA1(applicativeEff));
module.exports = {
    foreachE: foreachE, 
    forE: forE, 
    whileE: whileE, 
    untilE: untilE, 
    runPure: runPure, 
    functorEff: functorEff, 
    applyEff: applyEff, 
    applicativeEff: applicativeEff, 
    bindEff: bindEff, 
    monadEff: monadEff
};

},{"Prelude":130}],41:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Error_Trans = require("Control.Monad.Error.Trans");
var Control_Monad_Except_Trans = require("Control.Monad.Except.Trans");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Control_Monad_Maybe_Trans = require("Control.Monad.Maybe.Trans");
var Control_Monad_Reader_Trans = require("Control.Monad.Reader.Trans");
var Control_Monad_Writer_Trans = require("Control.Monad.Writer.Trans");
var Control_Monad_State_Trans = require("Control.Monad.State.Trans");
var Control_Monad_Error = require("Control.Monad.Error");
var Data_Either = require("Data.Either");
var Data_Maybe = require("Data.Maybe");
var Data_Monoid = require("Data.Monoid");
var MonadError = function (catchError, throwError) {
    this.catchError = catchError;
    this.throwError = throwError;
};
var throwError = function (dict) {
    return dict.throwError;
};
var monadErrorMaybe = new MonadError(function (_315) {
    return function (f) {
        if (_315 instanceof Data_Maybe.Nothing) {
            return f(Prelude.unit);
        };
        if (_315 instanceof Data_Maybe.Just) {
            return new Data_Maybe.Just(_315.value0);
        };
        throw new Error("Failed pattern match");
    };
}, Prelude["const"](Data_Maybe.Nothing.value));
var monadErrorExceptT = function (__dict_Monad_0) {
    return new MonadError(Control_Monad_Except_Trans.catchE(__dict_Monad_0), Control_Monad_Except_Trans.throwE(__dict_Monad_0["__superclass_Prelude.Applicative_0"]()));
};
var monadErrorErrorT = function (__dict_Monad_1) {
    return new MonadError(function (m) {
        return function (h) {
            return Control_Monad_Error_Trans.ErrorT(Prelude[">>="](__dict_Monad_1["__superclass_Prelude.Bind_1"]())(Control_Monad_Error_Trans.runErrorT(m))(function (_26) {
                if (_26 instanceof Data_Either.Left) {
                    return Control_Monad_Error_Trans.runErrorT(h(_26.value0));
                };
                if (_26 instanceof Data_Either.Right) {
                    return Prelude["return"](__dict_Monad_1)(new Data_Either.Right(_26.value0));
                };
                throw new Error("Failed pattern match");
            }));
        };
    }, function (e) {
        return Control_Monad_Error_Trans.ErrorT(Prelude["return"](__dict_Monad_1)(new Data_Either.Left(e)));
    });
};
var monadErrorEither = new MonadError(function (_314) {
    return function (h) {
        if (_314 instanceof Data_Either.Left) {
            return h(_314.value0);
        };
        if (_314 instanceof Data_Either.Right) {
            return new Data_Either.Right(_314.value0);
        };
        throw new Error("Failed pattern match");
    };
}, Data_Either.Left.create);
var catchError = function (dict) {
    return dict.catchError;
};
var catchJust = function (__dict_MonadError_2) {
    return function (p) {
        return function (act) {
            return function (handler) {
                var handle = function (e) {
                    var _1382 = p(e);
                    if (_1382 instanceof Data_Maybe.Nothing) {
                        return throwError(__dict_MonadError_2)(e);
                    };
                    if (_1382 instanceof Data_Maybe.Just) {
                        return handler(_1382.value0);
                    };
                    throw new Error("Failed pattern match");
                };
                return catchError(__dict_MonadError_2)(act)(handle);
            };
        };
    };
};
var monadErrorMaybeT = function (__dict_Monad_3) {
    return function (__dict_MonadError_4) {
        return new MonadError(Control_Monad_Maybe_Trans.liftCatchMaybe(catchError(__dict_MonadError_4)), function (e) {
            return Control_Monad_Trans.lift(Control_Monad_Maybe_Trans.monadTransMaybeT)(__dict_Monad_3)(throwError(__dict_MonadError_4)(e));
        });
    };
};
var monadErrorReaderT = function (__dict_Monad_5) {
    return function (__dict_MonadError_6) {
        return new MonadError(Control_Monad_Reader_Trans.liftCatchReader(catchError(__dict_MonadError_6)), function (e) {
            return Control_Monad_Trans.lift(Control_Monad_Reader_Trans.monadTransReaderT)(__dict_Monad_5)(throwError(__dict_MonadError_6)(e));
        });
    };
};
var monadErrorStateT = function (__dict_Monad_7) {
    return function (__dict_MonadError_8) {
        return new MonadError(Control_Monad_State_Trans.liftCatchState(catchError(__dict_MonadError_8)), function (e) {
            return Control_Monad_Trans.lift(Control_Monad_State_Trans.monadTransStateT)(__dict_Monad_7)(throwError(__dict_MonadError_8)(e));
        });
    };
};
var monadErrorWriterT = function (__dict_Monad_9) {
    return function (__dict_Monoid_10) {
        return function (__dict_MonadError_11) {
            return new MonadError(Control_Monad_Writer_Trans.liftCatchWriter(catchError(__dict_MonadError_11)), function (e) {
                return Control_Monad_Trans.lift(Control_Monad_Writer_Trans.monadTransWriterT(__dict_Monoid_10))(__dict_Monad_9)(throwError(__dict_MonadError_11)(e));
            });
        };
    };
};
module.exports = {
    MonadError: MonadError, 
    catchJust: catchJust, 
    catchError: catchError, 
    throwError: throwError, 
    monadErrorEither: monadErrorEither, 
    monadErrorMaybe: monadErrorMaybe, 
    monadErrorErrorT: monadErrorErrorT, 
    monadErrorExceptT: monadErrorExceptT, 
    monadErrorMaybeT: monadErrorMaybeT, 
    monadErrorReaderT: monadErrorReaderT, 
    monadErrorWriterT: monadErrorWriterT, 
    monadErrorStateT: monadErrorStateT
};

},{"Control.Monad.Error":43,"Control.Monad.Error.Trans":42,"Control.Monad.Except.Trans":44,"Control.Monad.Maybe.Trans":46,"Control.Monad.Reader.Trans":49,"Control.Monad.State.Trans":51,"Control.Monad.Trans":52,"Control.Monad.Writer.Trans":54,"Data.Either":74,"Data.Maybe":89,"Data.Monoid":96,"Prelude":130}],42:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Apply = require("Control.Apply");
var Control_Monad_Error = require("Control.Monad.Error");
var Control_Alt = require("Control.Alt");
var Control_Alternative = require("Control.Alternative");
var Control_Plus = require("Control.Plus");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Control_MonadPlus = require("Control.MonadPlus");
var Data_Either = require("Data.Either");
var Data_Monoid = require("Data.Monoid");
var Data_Tuple = require("Data.Tuple");
var ErrorT = function (x) {
    return x;
};
var runErrorT = function (_296) {
    return _296;
};
var monadTransErrorT = new Control_Monad_Trans.MonadTrans(function (__dict_Monad_2) {
    return function (m) {
        return ErrorT(Prelude[">>="](__dict_Monad_2["__superclass_Prelude.Bind_1"]())(m)(function (_12) {
            return Prelude["return"](__dict_Monad_2)(new Data_Either.Right(_12));
        }));
    };
});
var mapErrorT = function (f) {
    return function (m) {
        return ErrorT(f(runErrorT(m)));
    };
};
var liftPassError = function (__dict_Monad_6) {
    return function (pass) {
        return mapErrorT(function (m) {
            return pass(Prelude[">>="](__dict_Monad_6["__superclass_Prelude.Bind_1"]())(m)(function (_14) {
                return Prelude["return"](__dict_Monad_6)((function () {
                    if (_14 instanceof Data_Either.Left) {
                        return new Data_Tuple.Tuple(new Data_Either.Left(_14.value0), Prelude.id(Prelude.categoryArr));
                    };
                    if (_14 instanceof Data_Either.Right) {
                        return new Data_Tuple.Tuple(new Data_Either.Right(_14.value0.value0), _14.value0.value1);
                    };
                    throw new Error("Failed pattern match");
                })());
            }));
        });
    };
};
var liftListenError = function (__dict_Monad_7) {
    return function (listen) {
        return mapErrorT(function (m) {
            return Prelude[">>="](__dict_Monad_7["__superclass_Prelude.Bind_1"]())(listen(m))(function (_13) {
                return Prelude["return"](__dict_Monad_7)(Prelude["<$>"](Data_Either.functorEither)(function (r) {
                    return new Data_Tuple.Tuple(r, _13.value1);
                })(_13.value0));
            });
        });
    };
};
var liftCallCCError = function (callCC) {
    return function (f) {
        return ErrorT(callCC(function (c) {
            return runErrorT(f(function (a) {
                return ErrorT(c(new Data_Either.Right(a)));
            }));
        }));
    };
};
var functorErrorT = function (__dict_Functor_8) {
    return new Prelude.Functor(function (f) {
        return Prelude["<<<"](Prelude.semigroupoidArr)(ErrorT)(Prelude["<<<"](Prelude.semigroupoidArr)(Prelude["<$>"](__dict_Functor_8)(Prelude["<$>"](Data_Either.functorEither)(f)))(runErrorT));
    });
};
var applyErrorT = function (__dict_Apply_10) {
    return new Prelude.Apply(function (_297) {
        return function (_298) {
            return ErrorT(Prelude["<*>"](__dict_Apply_10)(Prelude["<$>"](__dict_Apply_10["__superclass_Prelude.Functor_0"]())(Control_Apply.lift2(Data_Either.applyEither)(Prelude["$"]))(_297))(_298));
        };
    }, function () {
        return functorErrorT(__dict_Apply_10["__superclass_Prelude.Functor_0"]());
    });
};
var bindErrorT = function (__dict_Monad_9) {
    return new Prelude.Bind(function (m) {
        return function (f) {
            return ErrorT(Prelude[">>="](__dict_Monad_9["__superclass_Prelude.Bind_1"]())(runErrorT(m))(function (_11) {
                if (_11 instanceof Data_Either.Left) {
                    return Prelude["return"](__dict_Monad_9)(new Data_Either.Left(_11.value0));
                };
                if (_11 instanceof Data_Either.Right) {
                    return runErrorT(f(_11.value0));
                };
                throw new Error("Failed pattern match");
            }));
        };
    }, function () {
        return applyErrorT((__dict_Monad_9["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]());
    });
};
var applicativeErrorT = function (__dict_Applicative_11) {
    return new Prelude.Applicative(function () {
        return applyErrorT(__dict_Applicative_11["__superclass_Prelude.Apply_0"]());
    }, function (a) {
        return ErrorT(Prelude.pure(__dict_Applicative_11)(new Data_Either.Right(a)));
    });
};
var monadErrorT = function (__dict_Monad_5) {
    return new Prelude.Monad(function () {
        return applicativeErrorT(__dict_Monad_5["__superclass_Prelude.Applicative_0"]());
    }, function () {
        return bindErrorT(__dict_Monad_5);
    });
};
var altErrorT = function (__dict_Monad_14) {
    return new Control_Alt.Alt(function (x) {
        return function (y) {
            return ErrorT(Prelude[">>="](__dict_Monad_14["__superclass_Prelude.Bind_1"]())(runErrorT(x))(function (e) {
                if (e instanceof Data_Either.Left) {
                    return runErrorT(y);
                };
                return Prelude["return"](__dict_Monad_14)(e);
            }));
        };
    }, function () {
        return functorErrorT(((__dict_Monad_14["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]());
    });
};
var plusErrorT = function (__dict_Monad_0) {
    return function (__dict_Error_1) {
        return new Control_Plus.Plus(function () {
            return altErrorT(__dict_Monad_0);
        }, Prelude["return"](__dict_Monad_0)(Data_Either.Left.create(Control_Monad_Error.strMsg(__dict_Error_1)("No alternative"))));
    };
};
var alternativeErrorT = function (__dict_Monad_12) {
    return function (__dict_Error_13) {
        return new Control_Alternative.Alternative(function () {
            return plusErrorT(__dict_Monad_12)(__dict_Error_13);
        }, function () {
            return applicativeErrorT(__dict_Monad_12["__superclass_Prelude.Applicative_0"]());
        });
    };
};
var monadPlusErrorT = function (__dict_Monad_3) {
    return function (__dict_Error_4) {
        return new Control_MonadPlus.MonadPlus(function () {
            return alternativeErrorT(__dict_Monad_3)(__dict_Error_4);
        }, function () {
            return monadErrorT(__dict_Monad_3);
        });
    };
};
module.exports = {
    ErrorT: ErrorT, 
    liftCallCCError: liftCallCCError, 
    liftPassError: liftPassError, 
    liftListenError: liftListenError, 
    mapErrorT: mapErrorT, 
    runErrorT: runErrorT, 
    functorErrorT: functorErrorT, 
    applyErrorT: applyErrorT, 
    applicativeErrorT: applicativeErrorT, 
    altErrorT: altErrorT, 
    plusErrorT: plusErrorT, 
    alternativeErrorT: alternativeErrorT, 
    bindErrorT: bindErrorT, 
    monadErrorT: monadErrorT, 
    monadPlusErrorT: monadPlusErrorT, 
    monadTransErrorT: monadTransErrorT
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Apply":28,"Control.Monad.Error":43,"Control.Monad.Trans":52,"Control.MonadPlus":57,"Control.Plus":58,"Data.Either":74,"Data.Monoid":96,"Data.Tuple":108,"Prelude":130}],43:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var $$Error = function (noMsg, strMsg) {
    this.noMsg = noMsg;
    this.strMsg = strMsg;
};
var strMsg = function (dict) {
    return dict.strMsg;
};
var noMsg = function (dict) {
    return dict.noMsg;
};
var errorString = new $$Error("", Prelude.id(Prelude.categoryArr));
module.exports = {
    "Error": $$Error, 
    strMsg: strMsg, 
    noMsg: noMsg, 
    errorString: errorString
};

},{"Prelude":130}],44:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Either = require("Data.Either");
var Data_Monoid = require("Data.Monoid");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var Control_MonadPlus = require("Control.MonadPlus");
var ExceptT = function (x) {
    return x;
};
var throwE = function (__dict_Applicative_0) {
    return Prelude["<<<"](Prelude.semigroupoidArr)(ExceptT)(Prelude["<<<"](Prelude.semigroupoidArr)(Prelude.pure(__dict_Applicative_0))(Data_Either.Left.create));
};
var runExceptT = function (_170) {
    return _170;
};
var withExceptT = function (__dict_Functor_1) {
    return function (f) {
        var mapLeft = function (f_1) {
            return function (_171) {
                if (_171 instanceof Data_Either.Right) {
                    return new Data_Either.Right(_171.value0);
                };
                if (_171 instanceof Data_Either.Left) {
                    return new Data_Either.Left(f_1(_171.value0));
                };
                throw new Error("Failed pattern match");
            };
        };
        return Prelude["<<<"](Prelude.semigroupoidArr)(ExceptT)(Prelude["<<<"](Prelude.semigroupoidArr)(Prelude["<$>"](__dict_Functor_1)(mapLeft(f)))(runExceptT));
    };
};
var mapExceptT = function (f) {
    return function (m) {
        return f(runExceptT(m));
    };
};
var functorExceptT = function (__dict_Functor_7) {
    return new Prelude.Functor(function (f) {
        return mapExceptT(Prelude["<$>"](__dict_Functor_7)(Prelude["<$>"](Data_Either.functorEither)(f)));
    });
};
var catchE = function (__dict_Monad_8) {
    return function (m) {
        return function (handler) {
            return Prelude[">>="](__dict_Monad_8["__superclass_Prelude.Bind_1"]())(runExceptT(m))(Data_Either.either(Prelude["<<<"](Prelude.semigroupoidArr)(runExceptT)(handler))(Prelude["<<<"](Prelude.semigroupoidArr)(Prelude.pure(__dict_Monad_8["__superclass_Prelude.Applicative_0"]()))(Data_Either.Right.create)));
        };
    };
};
var applyExceptT = function (__dict_Apply_10) {
    return new Prelude.Apply(function (_172) {
        return function (_173) {
            var f$prime = Prelude["<$>"](__dict_Apply_10["__superclass_Prelude.Functor_0"]())(Prelude["<*>"](Data_Either.applyEither))(_172);
            var x$prime = Prelude["<*>"](__dict_Apply_10)(f$prime)(_173);
            return x$prime;
        };
    }, function () {
        return functorExceptT(__dict_Apply_10["__superclass_Prelude.Functor_0"]());
    });
};
var bindExceptT = function (__dict_Monad_9) {
    return new Prelude.Bind(function (m) {
        return function (k) {
            return Prelude[">>="](__dict_Monad_9["__superclass_Prelude.Bind_1"]())(runExceptT(m))(Data_Either.either(Prelude["<<<"](Prelude.semigroupoidArr)(Prelude["return"](__dict_Monad_9))(Data_Either.Left.create))(Prelude["<<<"](Prelude.semigroupoidArr)(runExceptT)(k)));
        };
    }, function () {
        return applyExceptT((__dict_Monad_9["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]());
    });
};
var applicativeExceptT = function (__dict_Applicative_11) {
    return new Prelude.Applicative(function () {
        return applyExceptT(__dict_Applicative_11["__superclass_Prelude.Apply_0"]());
    }, Prelude["<<<"](Prelude.semigroupoidArr)(ExceptT)(Prelude["<<<"](Prelude.semigroupoidArr)(Prelude.pure(__dict_Applicative_11))(Data_Either.Right.create)));
};
var monadExceptT = function (__dict_Monad_6) {
    return new Prelude.Monad(function () {
        return applicativeExceptT(__dict_Monad_6["__superclass_Prelude.Applicative_0"]());
    }, function () {
        return bindExceptT(__dict_Monad_6);
    });
};
var altExceptT = function (__dict_Semigroup_14) {
    return function (__dict_Monad_15) {
        return new Control_Alt.Alt(function (m) {
            return function (n) {
                return ExceptT(Prelude[">>="](__dict_Monad_15["__superclass_Prelude.Bind_1"]())(runExceptT(m))(function (_10) {
                    if (_10 instanceof Data_Either.Right) {
                        return Prelude.pure(__dict_Monad_15["__superclass_Prelude.Applicative_0"]())(new Data_Either.Right(_10.value0));
                    };
                    if (_10 instanceof Data_Either.Left) {
                        return Prelude[">>="](__dict_Monad_15["__superclass_Prelude.Bind_1"]())(runExceptT(n))(function (_9) {
                            if (_9 instanceof Data_Either.Right) {
                                return Prelude.pure(__dict_Monad_15["__superclass_Prelude.Applicative_0"]())(new Data_Either.Right(_9.value0));
                            };
                            if (_9 instanceof Data_Either.Left) {
                                return Prelude.pure(__dict_Monad_15["__superclass_Prelude.Applicative_0"]())(new Data_Either.Left(Prelude["<>"](__dict_Semigroup_14)(_10.value0)(_9.value0)));
                            };
                            throw new Error("Failed pattern match");
                        });
                    };
                    throw new Error("Failed pattern match");
                }));
            };
        }, function () {
            return functorExceptT(((__dict_Monad_15["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]());
        });
    };
};
var plusExceptT = function (__dict_Monoid_2) {
    return function (__dict_Monad_3) {
        return new Control_Plus.Plus(function () {
            return altExceptT(__dict_Monoid_2["__superclass_Prelude.Semigroup_0"]())(__dict_Monad_3);
        }, throwE(__dict_Monad_3["__superclass_Prelude.Applicative_0"]())(Data_Monoid.mempty(__dict_Monoid_2)));
    };
};
var alternativeExceptT = function (__dict_Monoid_12) {
    return function (__dict_Monad_13) {
        return new Control_Alternative.Alternative(function () {
            return plusExceptT(__dict_Monoid_12)(__dict_Monad_13);
        }, function () {
            return applicativeExceptT(__dict_Monad_13["__superclass_Prelude.Applicative_0"]());
        });
    };
};
var monadPlusExceptT = function (__dict_Monoid_4) {
    return function (__dict_Monad_5) {
        return new Control_MonadPlus.MonadPlus(function () {
            return alternativeExceptT(__dict_Monoid_4)(__dict_Monad_5);
        }, function () {
            return monadExceptT(__dict_Monad_5);
        });
    };
};
module.exports = {
    ExceptT: ExceptT, 
    catchE: catchE, 
    throwE: throwE, 
    mapExceptT: mapExceptT, 
    withExceptT: withExceptT, 
    runExceptT: runExceptT, 
    functorExceptT: functorExceptT, 
    applyExceptT: applyExceptT, 
    applicativeExceptT: applicativeExceptT, 
    bindExceptT: bindExceptT, 
    monadExceptT: monadExceptT, 
    altExceptT: altExceptT, 
    plusExceptT: plusExceptT, 
    alternativeExceptT: alternativeExceptT, 
    monadPlusExceptT: monadPlusExceptT
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.MonadPlus":57,"Control.Plus":58,"Data.Either":74,"Data.Monoid":96,"Prelude":130}],45:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Lazy = require("Data.Lazy");
var Data_Array = require("Data.Array");
var Data_Maybe = require("Data.Maybe");
var Data_Tuple = require("Data.Tuple");
var Data_Monoid = require("Data.Monoid");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Data_Unfoldable = require("Data.Unfoldable");
var Control_Alternative = require("Control.Alternative");
var Control_MonadPlus = require("Control.MonadPlus");
var Control_Monad = require("Control.Monad");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Yield = (function () {
    function Yield(value0, value1) {
        this.value0 = value0;
        this.value1 = value1;
    };
    Yield.create = function (value0) {
        return function (value1) {
            return new Yield(value0, value1);
        };
    };
    return Yield;
})();
var Skip = (function () {
    function Skip(value0) {
        this.value0 = value0;
    };
    Skip.create = function (value0) {
        return new Skip(value0);
    };
    return Skip;
})();
var Done = (function () {
    function Done() {

    };
    Done.value = new Done();
    return Done;
})();
var ListT = (function () {
    function ListT(value0) {
        this.value0 = value0;
    };
    ListT.create = function (value0) {
        return new ListT(value0);
    };
    return ListT;
})();
var ZipListT = function (x) {
    return x;
};
var zipList = ZipListT;
var wrapLazy = function (__dict_Monad_0) {
    return function (v) {
        return ListT.create(Prelude.pure(__dict_Monad_0["__superclass_Prelude.Applicative_0"]())(new Skip(v)));
    };
};
var wrapEffect = function (__dict_Monad_1) {
    return function (v) {
        return ListT.create(Prelude["<$>"](((__dict_Monad_1["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Prelude["<<<"](Prelude.semigroupoidArr)(Skip.create)(Prelude["<<<"](Prelude.semigroupoidArr)(Data_Lazy.defer)(Prelude["const"])))(v));
    };
};
var unfold = function (__dict_Monad_2) {
    return function (f) {
        return function (z) {
            var g = function (_606) {
                if (_606 instanceof Data_Maybe.Just) {
                    return new Yield(_606.value0.value1, Data_Lazy.defer(function (_598) {
                        return unfold(__dict_Monad_2)(f)(_606.value0.value0);
                    }));
                };
                if (_606 instanceof Data_Maybe.Nothing) {
                    return Done.value;
                };
                throw new Error("Failed pattern match");
            };
            return ListT.create(Prelude["<$>"](((__dict_Monad_2["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(g)(f(z)));
        };
    };
};
var runListT = function (_601) {
    return _601.value0;
};
var scanl = function (__dict_Monad_4) {
    return function (f) {
        return function (b) {
            return function (l) {
                var g = function (_616) {
                    var h = function (_617) {
                        if (_617 instanceof Yield) {
                            var b$prime = f(_616.value0)(_617.value0);
                            return Data_Maybe.Just.create(new Data_Tuple.Tuple(new Data_Tuple.Tuple(b$prime, Data_Lazy.force(_617.value1)), b$prime));
                        };
                        if (_617 instanceof Skip) {
                            return Data_Maybe.Just.create(new Data_Tuple.Tuple(new Data_Tuple.Tuple(_616.value0, Data_Lazy.force(_617.value0)), _616.value0));
                        };
                        if (_617 instanceof Done) {
                            return Data_Maybe.Nothing.value;
                        };
                        throw new Error("Failed pattern match");
                    };
                    return Prelude["<$>"](((__dict_Monad_4["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(h)(runListT(_616.value1));
                };
                return unfold(__dict_Monad_4)(g)(new Data_Tuple.Tuple(b, l));
            };
        };
    };
};
var stepMap = function (__dict_Functor_5) {
    return function (f) {
        return function (l) {
            return ListT.create(Prelude["<$>"](__dict_Functor_5)(f)(runListT(l)));
        };
    };
};
var takeWhile = function (__dict_Applicative_6) {
    return function (f) {
        var g = function (_608) {
            if (_608 instanceof Yield) {
                var ifThenElse = function (p) {
                    return function (a_1) {
                        return function (b) {
                            if (p) {
                                return a_1;
                            };
                            if (!p) {
                                return b;
                            };
                            throw new Error("Failed pattern match");
                        };
                    };
                };
                return ifThenElse(f(_608.value0))(new Yield(_608.value0, Prelude["<$>"](Data_Lazy.functorLazy)(takeWhile(__dict_Applicative_6)(f))(_608.value1)))(Done.value);
            };
            if (_608 instanceof Skip) {
                return Skip.create(Prelude["<$>"](Data_Lazy.functorLazy)(takeWhile(__dict_Applicative_6)(f))(_608.value0));
            };
            if (_608 instanceof Done) {
                return Done.value;
            };
            throw new Error("Failed pattern match");
        };
        return stepMap((__dict_Applicative_6["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(g);
    };
};
var uncons = function (__dict_Monad_7) {
    return function (l) {
        var g = function (_613) {
            if (_613 instanceof Yield) {
                return Prelude.pure(__dict_Monad_7["__superclass_Prelude.Applicative_0"]())(Data_Maybe.Just.create(new Data_Tuple.Tuple(_613.value0, Data_Lazy.force(_613.value1))));
            };
            if (_613 instanceof Skip) {
                return uncons(__dict_Monad_7)(Data_Lazy.force(_613.value0));
            };
            if (_613 instanceof Done) {
                return Prelude.pure(__dict_Monad_7["__superclass_Prelude.Applicative_0"]())(Data_Maybe.Nothing.value);
            };
            throw new Error("Failed pattern match");
        };
        return Prelude[">>="](__dict_Monad_7["__superclass_Prelude.Bind_1"]())(runListT(l))(g);
    };
};
var tail = function (__dict_Monad_8) {
    return function (l) {
        return Prelude["<$>"](((__dict_Monad_8["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Prelude["<$>"](Data_Maybe.functorMaybe)(Data_Tuple.snd))(uncons(__dict_Monad_8)(l));
    };
};
var prepend$prime = function (__dict_Applicative_9) {
    return function (h) {
        return function (t) {
            return ListT.create(Prelude.pure(__dict_Applicative_9)(new Yield(h, t)));
        };
    };
};
var prepend = function (__dict_Applicative_10) {
    return function (h) {
        return function (t) {
            return prepend$prime(__dict_Applicative_10)(h)(Data_Lazy.defer(Prelude["const"](t)));
        };
    };
};
var nil = function (__dict_Applicative_12) {
    return ListT.create(Prelude.pure(__dict_Applicative_12)(Done.value));
};
var singleton = function (__dict_Applicative_14) {
    return function (a) {
        return prepend(__dict_Applicative_14)(a)(nil(__dict_Applicative_14));
    };
};
var take = function (__dict_Applicative_15) {
    return function (_602) {
        return function (fa) {
            if (_602 === 0) {
                return nil(__dict_Applicative_15);
            };
            var f = function (_607) {
                if (_607 instanceof Yield) {
                    var s$prime = Prelude["<$>"](Data_Lazy.functorLazy)(take(__dict_Applicative_15)(_602 - 1))(_607.value1);
                    return new Yield(_607.value0, s$prime);
                };
                if (_607 instanceof Skip) {
                    var s$prime = Prelude["<$>"](Data_Lazy.functorLazy)(take(__dict_Applicative_15)(_602))(_607.value0);
                    return new Skip(s$prime);
                };
                if (_607 instanceof Done) {
                    return Done.value;
                };
                throw new Error("Failed pattern match");
            };
            return stepMap((__dict_Applicative_15["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(f)(fa);
        };
    };
};
var zipWith$prime = function (__dict_Monad_16) {
    return function (f) {
        var loop = function (fa) {
            return function (fb) {
                var g = function (_618) {
                    return function (_619) {
                        if (_619 instanceof Data_Maybe.Nothing) {
                            return Prelude.pure(__dict_Monad_16["__superclass_Prelude.Applicative_0"]())(nil(__dict_Monad_16["__superclass_Prelude.Applicative_0"]()));
                        };
                        if (_618 instanceof Data_Maybe.Nothing) {
                            return Prelude.pure(__dict_Monad_16["__superclass_Prelude.Applicative_0"]())(nil(__dict_Monad_16["__superclass_Prelude.Applicative_0"]()));
                        };
                        if (_618 instanceof Data_Maybe.Just && _619 instanceof Data_Maybe.Just) {
                            return Prelude["<$>"](((__dict_Monad_16["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Prelude.flip(prepend$prime(__dict_Monad_16["__superclass_Prelude.Applicative_0"]()))(Data_Lazy.defer(function (_599) {
                                return zipWith$prime(__dict_Monad_16)(f)(_618.value0.value1)(_619.value0.value1);
                            })))(f(_618.value0.value0)(_619.value0.value0));
                        };
                        throw new Error("Failed pattern match");
                    };
                };
                return wrapEffect(__dict_Monad_16)(Prelude[">>="](__dict_Monad_16["__superclass_Prelude.Bind_1"]())(uncons(__dict_Monad_16)(fa))(function (_49) {
                    return Prelude[">>="](__dict_Monad_16["__superclass_Prelude.Bind_1"]())(uncons(__dict_Monad_16)(fb))(function (_48) {
                        return g(_49)(_48);
                    });
                }));
            };
        };
        return loop;
    };
};
var zipWith = function (__dict_Monad_17) {
    return function (f) {
        var g = function (a) {
            return function (b) {
                return Prelude.pure(__dict_Monad_17["__superclass_Prelude.Applicative_0"]())(f(a)(b));
            };
        };
        return zipWith$prime(__dict_Monad_17)(g);
    };
};
var mapMaybe = function (__dict_Functor_22) {
    return function (f) {
        var g = function (_612) {
            if (_612 instanceof Yield) {
                return Data_Maybe.fromMaybe(Skip.create)(Prelude["<$>"](Data_Maybe.functorMaybe)(Yield.create)(f(_612.value0)))(Prelude["<$>"](Data_Lazy.functorLazy)(mapMaybe(__dict_Functor_22)(f))(_612.value1));
            };
            if (_612 instanceof Skip) {
                return Skip.create(Prelude["<$>"](Data_Lazy.functorLazy)(mapMaybe(__dict_Functor_22)(f))(_612.value0));
            };
            if (_612 instanceof Done) {
                return Done.value;
            };
            throw new Error("Failed pattern match");
        };
        return stepMap(__dict_Functor_22)(g);
    };
};
var iterate = function (__dict_Monad_23) {
    return function (f) {
        return function (a) {
            var g = function (a_1) {
                return Prelude.pure(__dict_Monad_23["__superclass_Prelude.Applicative_0"]())(new Data_Maybe.Just(new Data_Tuple.Tuple(f(a_1), a_1)));
            };
            return unfold(__dict_Monad_23)(g)(a);
        };
    };
};
var repeat = function (__dict_Monad_24) {
    return iterate(__dict_Monad_24)(Prelude.id(Prelude.categoryArr));
};
var head = function (__dict_Monad_25) {
    return function (l) {
        return Prelude["<$>"](((__dict_Monad_25["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Prelude["<$>"](Data_Maybe.functorMaybe)(Data_Tuple.fst))(uncons(__dict_Monad_25)(l));
    };
};
var functorListT = function (__dict_Functor_27) {
    return new Prelude.Functor(function (f) {
        var g = function (_622) {
            if (_622 instanceof Yield) {
                return new Yield(f(_622.value0), Prelude["<$>"](Data_Lazy.functorLazy)(Prelude["<$>"](functorListT(__dict_Functor_27))(f))(_622.value1));
            };
            if (_622 instanceof Skip) {
                return new Skip(Prelude["<$>"](Data_Lazy.functorLazy)(Prelude["<$>"](functorListT(__dict_Functor_27))(f))(_622.value0));
            };
            if (_622 instanceof Done) {
                return Done.value;
            };
            throw new Error("Failed pattern match");
        };
        return stepMap(__dict_Functor_27)(g);
    });
};
var functorZipListT = function (__dict_Functor_26) {
    return new Prelude.Functor(function (f) {
        return function (_623) {
            return ZipListT(Prelude["<$>"](functorListT(__dict_Functor_26))(f)(_623));
        };
    });
};
var fromEffect = function (__dict_Applicative_28) {
    return function (fa) {
        return ListT.create(Prelude["<$>"]((__dict_Applicative_28["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Prelude.flip(Yield.create)(Data_Lazy.defer(function (_597) {
            return nil(__dict_Applicative_28);
        })))(fa));
    };
};
var monadTransListT = new Control_Monad_Trans.MonadTrans(function (__dict_Monad_29) {
    return fromEffect(__dict_Monad_29["__superclass_Prelude.Applicative_0"]());
});
var fromArray = function (__dict_Monad_30) {
    return function (xs) {
        var f = function (n) {
            return Prelude.pure(__dict_Monad_30["__superclass_Prelude.Applicative_0"]())(Prelude["<$>"](Data_Maybe.functorMaybe)(Data_Tuple.Tuple.create(n + 1))(Data_Array["!!"](xs)(n)));
        };
        return unfold(__dict_Monad_30)(f)(0);
    };
};
var foldl$prime = function (__dict_Monad_31) {
    return function (f) {
        var loop = function (b) {
            return function (l) {
                var g = function (_614) {
                    if (_614 instanceof Data_Maybe.Nothing) {
                        return Prelude.pure(__dict_Monad_31["__superclass_Prelude.Applicative_0"]())(b);
                    };
                    if (_614 instanceof Data_Maybe.Just) {
                        return Prelude[">>="](__dict_Monad_31["__superclass_Prelude.Bind_1"]())(f(b)(_614.value0.value0))(Prelude.flip(loop)(_614.value0.value1));
                    };
                    throw new Error("Failed pattern match");
                };
                return Prelude[">>="](__dict_Monad_31["__superclass_Prelude.Bind_1"]())(uncons(__dict_Monad_31)(l))(g);
            };
        };
        return loop;
    };
};
var foldl = function (__dict_Monad_32) {
    return function (f) {
        var loop = function (b) {
            return function (l) {
                var g = function (_615) {
                    if (_615 instanceof Data_Maybe.Nothing) {
                        return Prelude.pure(__dict_Monad_32["__superclass_Prelude.Applicative_0"]())(b);
                    };
                    if (_615 instanceof Data_Maybe.Just) {
                        return loop(f(b)(_615.value0.value0))(_615.value0.value1);
                    };
                    throw new Error("Failed pattern match");
                };
                return Prelude[">>="](__dict_Monad_32["__superclass_Prelude.Bind_1"]())(uncons(__dict_Monad_32)(l))(g);
            };
        };
        return loop;
    };
};
var toArray = function (__dict_Monad_33) {
    return Prelude["<<<"](Prelude.semigroupoidArr)(Prelude["<$>"](((__dict_Monad_33["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Array.reverse))(foldl(__dict_Monad_33)(Prelude.flip(Prelude[":"]))([  ]));
};
var filter = function (__dict_Functor_34) {
    return function (f) {
        var g = function (_611) {
            if (_611 instanceof Yield) {
                var s$prime = Prelude["<$>"](Data_Lazy.functorLazy)(filter(__dict_Functor_34)(f))(_611.value1);
                var _2701 = f(_611.value0);
                if (_2701) {
                    return new Yield(_611.value0, s$prime);
                };
                if (!_2701) {
                    return new Skip(s$prime);
                };
                throw new Error("Failed pattern match");
            };
            if (_611 instanceof Skip) {
                var s$prime = Prelude["<$>"](Data_Lazy.functorLazy)(filter(__dict_Functor_34)(f))(_611.value0);
                return new Skip(s$prime);
            };
            if (_611 instanceof Done) {
                return Done.value;
            };
            throw new Error("Failed pattern match");
        };
        return stepMap(__dict_Functor_34)(g);
    };
};
var dropWhile = function (__dict_Applicative_35) {
    return function (f) {
        var g = function (_610) {
            if (_610 instanceof Yield) {
                var _2706 = f(_610.value0);
                if (_2706) {
                    return new Skip(Prelude["<$>"](Data_Lazy.functorLazy)(dropWhile(__dict_Applicative_35)(f))(_610.value1));
                };
                if (!_2706) {
                    return new Yield(_610.value0, _610.value1);
                };
                throw new Error("Failed pattern match");
            };
            if (_610 instanceof Skip) {
                return Skip.create(Prelude["<$>"](Data_Lazy.functorLazy)(dropWhile(__dict_Applicative_35)(f))(_610.value0));
            };
            if (_610 instanceof Done) {
                return Done.value;
            };
            throw new Error("Failed pattern match");
        };
        return stepMap((__dict_Applicative_35["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(g);
    };
};
var drop = function (__dict_Applicative_36) {
    return function (_603) {
        return function (fa) {
            if (_603 === 0) {
                return fa;
            };
            var f = function (_609) {
                if (_609 instanceof Yield) {
                    var s$prime = Prelude["<$>"](Data_Lazy.functorLazy)(drop(__dict_Applicative_36)(_603 - 1))(_609.value1);
                    return new Skip(s$prime);
                };
                if (_609 instanceof Skip) {
                    var s$prime = Prelude["<$>"](Data_Lazy.functorLazy)(drop(__dict_Applicative_36)(_603))(_609.value0);
                    return new Skip(s$prime);
                };
                if (_609 instanceof Done) {
                    return Done.value;
                };
                throw new Error("Failed pattern match");
            };
            return stepMap((__dict_Applicative_36["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(f)(fa);
        };
    };
};
var cons$prime = function (__dict_Applicative_37) {
    return function (lh) {
        return function (t) {
            var f = function (_604) {
                return new Yield(Data_Lazy.force(lh), t);
            };
            return ListT.create(Prelude["<$>"]((__dict_Applicative_37["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(f)(Prelude.pure(__dict_Applicative_37)(Prelude.unit)));
        };
    };
};
var unfoldableListT = function (__dict_Monad_38) {
    return new Data_Unfoldable.Unfoldable(function (f) {
        return function (b) {
            var go = function (_624) {
                if (_624 instanceof Data_Maybe.Nothing) {
                    return nil(__dict_Monad_38["__superclass_Prelude.Applicative_0"]());
                };
                if (_624 instanceof Data_Maybe.Just) {
                    return cons$prime(__dict_Monad_38["__superclass_Prelude.Applicative_0"]())(Prelude.pure(Data_Lazy.applicativeLazy)(_624.value0.value0))(Data_Lazy.defer(function (_600) {
                        return go(f(_624.value0.value1));
                    }));
                };
                throw new Error("Failed pattern match");
            };
            return go(f(b));
        };
    });
};
var semigroupListT = function (__dict_Applicative_40) {
    return new Prelude.Semigroup(concat(__dict_Applicative_40));
};
var concat = function (__dict_Applicative_39) {
    return function (x) {
        return function (y) {
            var f = function (_605) {
                if (_605 instanceof Yield) {
                    return new Yield(_605.value0, Prelude["<$>"](Data_Lazy.functorLazy)(Prelude.flip(Prelude["<>"](semigroupListT(__dict_Applicative_39)))(y))(_605.value1));
                };
                if (_605 instanceof Skip) {
                    return new Skip(Prelude["<$>"](Data_Lazy.functorLazy)(Prelude.flip(Prelude["<>"](semigroupListT(__dict_Applicative_39)))(y))(_605.value0));
                };
                if (_605 instanceof Done) {
                    return new Skip(Data_Lazy.defer(Prelude["const"](y)));
                };
                throw new Error("Failed pattern match");
            };
            return stepMap((__dict_Applicative_39["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(f)(x);
        };
    };
};
var monoidListT = function (__dict_Applicative_19) {
    return new Data_Monoid.Monoid(function () {
        return semigroupListT(__dict_Applicative_19);
    }, nil(__dict_Applicative_19));
};
var semigroupZipListT = function (__dict_Applicative_3) {
    return new Prelude.Semigroup(function (_620) {
        return function (_621) {
            return ZipListT(Prelude["<>"](semigroupListT(__dict_Applicative_3))(_620)(_621));
        };
    });
};
var monoidZipListT = function (__dict_Applicative_18) {
    return new Data_Monoid.Monoid(function () {
        return semigroupZipListT(__dict_Applicative_18);
    }, Data_Monoid.mempty(monoidListT(__dict_Applicative_18)));
};
var catMaybes = function (__dict_Functor_41) {
    return mapMaybe(__dict_Functor_41)(Prelude.id(Prelude.categoryArr));
};
var applyZipListT = function (__dict_Monad_43) {
    return new Prelude.Apply(function (_625) {
        return function (_626) {
            var g = function (f) {
                return function (x) {
                    return f(x);
                };
            };
            return ZipListT(zipWith(__dict_Monad_43)(g)(_625)(_626));
        };
    }, function () {
        return functorZipListT(((__dict_Monad_43["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]());
    });
};
var monadListT = function (__dict_Monad_21) {
    return new Prelude.Monad(function () {
        return applicativeListT(__dict_Monad_21);
    }, function () {
        return bindListT(__dict_Monad_21);
    });
};
var bindListT = function (__dict_Monad_42) {
    return new Prelude.Bind(function (fa) {
        return function (f) {
            var g = function (_627) {
                if (_627 instanceof Yield) {
                    var h = function (s_1) {
                        return concat(__dict_Monad_42["__superclass_Prelude.Applicative_0"]())(f(_627.value0))(Prelude[">>="](bindListT(__dict_Monad_42))(s_1)(f));
                    };
                    return new Skip(Prelude["<$>"](Data_Lazy.functorLazy)(h)(_627.value1));
                };
                if (_627 instanceof Skip) {
                    var h = function (s_2) {
                        return Prelude[">>="](bindListT(__dict_Monad_42))(s_2)(f);
                    };
                    return new Skip(Prelude["<$>"](Data_Lazy.functorLazy)(h)(_627.value0));
                };
                if (_627 instanceof Done) {
                    return Done.value;
                };
                throw new Error("Failed pattern match");
            };
            return stepMap(((__dict_Monad_42["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(g)(fa);
        };
    }, function () {
        return applyListT(__dict_Monad_42);
    });
};
var applyListT = function (__dict_Monad_44) {
    return new Prelude.Apply(function (f) {
        return function (x) {
            return Prelude[">>="](bindListT(__dict_Monad_44))(f)(function (_51) {
                return Prelude[">>="](bindListT(__dict_Monad_44))(x)(function (_50) {
                    return Prelude["return"](monadListT(__dict_Monad_44))(_51(_50));
                });
            });
        };
    }, function () {
        return functorListT(((__dict_Monad_44["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]());
    });
};
var applicativeListT = function (__dict_Monad_46) {
    return new Prelude.Applicative(function () {
        return applyListT(__dict_Monad_46);
    }, singleton(__dict_Monad_46["__superclass_Prelude.Applicative_0"]()));
};
var applicativeZipListT = function (__dict_Monad_45) {
    return new Prelude.Applicative(function () {
        return applyZipListT(__dict_Monad_45);
    }, Prelude["<<<"](Prelude.semigroupoidArr)(ZipListT)(Prelude.pure(applicativeListT(__dict_Monad_45))));
};
var altListT = function (__dict_Applicative_50) {
    return new Control_Alt.Alt(concat(__dict_Applicative_50), function () {
        return functorListT((__dict_Applicative_50["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]());
    });
};
var altZipListT = function (__dict_Applicative_49) {
    return new Control_Alt.Alt(function (_628) {
        return function (_629) {
            return ZipListT(Control_Alt["<|>"](altListT(__dict_Applicative_49))(_628)(_629));
        };
    }, function () {
        return functorZipListT((__dict_Applicative_49["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]());
    });
};
var plusListT = function (__dict_Monad_13) {
    return new Control_Plus.Plus(function () {
        return altListT(__dict_Monad_13["__superclass_Prelude.Applicative_0"]());
    }, nil(__dict_Monad_13["__superclass_Prelude.Applicative_0"]()));
};
var alternativeListT = function (__dict_Monad_48) {
    return new Control_Alternative.Alternative(function () {
        return plusListT(__dict_Monad_48);
    }, function () {
        return applicativeListT(__dict_Monad_48);
    });
};
var monadPlusListT = function (__dict_Monad_20) {
    return new Control_MonadPlus.MonadPlus(function () {
        return alternativeListT(__dict_Monad_20);
    }, function () {
        return monadListT(__dict_Monad_20);
    });
};
var plusZipListT = function (__dict_Monad_11) {
    return new Control_Plus.Plus(function () {
        return altZipListT(__dict_Monad_11["__superclass_Prelude.Applicative_0"]());
    }, Control_Plus.empty(plusListT(__dict_Monad_11)));
};
var alternativeZipListT = function (__dict_Monad_47) {
    return new Control_Alternative.Alternative(function () {
        return plusZipListT(__dict_Monad_47);
    }, function () {
        return applicativeZipListT(__dict_Monad_47);
    });
};
module.exports = {
    zipList: zipList, 
    "zipWith'": zipWith$prime, 
    zipWith: zipWith, 
    wrapLazy: wrapLazy, 
    wrapEffect: wrapEffect, 
    unfold: unfold, 
    uncons: uncons, 
    toArray: toArray, 
    takeWhile: takeWhile, 
    take: take, 
    tail: tail, 
    singleton: singleton, 
    scanl: scanl, 
    repeat: repeat, 
    "prepend'": prepend$prime, 
    prepend: prepend, 
    nil: nil, 
    mapMaybe: mapMaybe, 
    iterate: iterate, 
    head: head, 
    fromEffect: fromEffect, 
    fromArray: fromArray, 
    "foldl'": foldl$prime, 
    foldl: foldl, 
    filter: filter, 
    dropWhile: dropWhile, 
    drop: drop, 
    "cons'": cons$prime, 
    catMaybes: catMaybes, 
    semigroupListT: semigroupListT, 
    semigroupZipListT: semigroupZipListT, 
    monoidListT: monoidListT, 
    monoidZipListT: monoidZipListT, 
    functorListT: functorListT, 
    functorZipListT: functorZipListT, 
    unfoldableListT: unfoldableListT, 
    applyListT: applyListT, 
    applyZipListT: applyZipListT, 
    applicativeListT: applicativeListT, 
    applicativeZipListT: applicativeZipListT, 
    bindListT: bindListT, 
    monadListT: monadListT, 
    monadTransListT: monadTransListT, 
    altListT: altListT, 
    altZipListT: altZipListT, 
    plusListT: plusListT, 
    plusZipListT: plusZipListT, 
    alternativeListT: alternativeListT, 
    alternativeZipListT: alternativeZipListT, 
    monadPlusListT: monadPlusListT
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Monad":56,"Control.Monad.Trans":52,"Control.MonadPlus":57,"Control.Plus":58,"Data.Array":61,"Data.Lazy":87,"Data.Maybe":89,"Data.Monoid":96,"Data.Tuple":108,"Data.Unfoldable":109,"Prelude":130}],46:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var Control_Monad = require("Control.Monad");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Control_MonadPlus = require("Control.MonadPlus");
var Data_Either = require("Data.Either");
var Data_Maybe = require("Data.Maybe");
var Data_Tuple = require("Data.Tuple");
var MaybeT = function (x) {
    return x;
};
var runMaybeT = function (_299) {
    return _299;
};
var monadTransMaybeT = new Control_Monad_Trans.MonadTrans(function (__dict_Monad_1) {
    return Prelude["<<<"](Prelude.semigroupoidArr)(MaybeT)(Prelude.liftM1(__dict_Monad_1)(Data_Maybe.Just.create));
});
var mapMaybeT = function (f) {
    return Prelude["<<<"](Prelude.semigroupoidArr)(MaybeT)(Prelude["<<<"](Prelude.semigroupoidArr)(f)(runMaybeT));
};
var liftPassMaybe = function (__dict_Monad_4) {
    return function (pass) {
        return mapMaybeT(function (m) {
            return pass(Prelude[">>="](__dict_Monad_4["__superclass_Prelude.Bind_1"]())(m)(function (_18) {
                return Prelude["return"](__dict_Monad_4)((function () {
                    if (_18 instanceof Data_Maybe.Nothing) {
                        return new Data_Tuple.Tuple(Data_Maybe.Nothing.value, Prelude.id(Prelude.categoryArr));
                    };
                    if (_18 instanceof Data_Maybe.Just) {
                        return new Data_Tuple.Tuple(new Data_Maybe.Just(_18.value0.value0), _18.value0.value1);
                    };
                    throw new Error("Failed pattern match");
                })());
            }));
        });
    };
};
var liftListenMaybe = function (__dict_Monad_5) {
    return function (listen) {
        return mapMaybeT(function (m) {
            return Prelude[">>="](__dict_Monad_5["__superclass_Prelude.Bind_1"]())(listen(m))(function (_17) {
                return Prelude["return"](__dict_Monad_5)(Prelude["<$>"](Data_Maybe.functorMaybe)(function (r) {
                    return new Data_Tuple.Tuple(r, _17.value1);
                })(_17.value0));
            });
        });
    };
};
var liftCatchMaybe = function ($$catch) {
    return function (m) {
        return function (h) {
            return MaybeT($$catch(runMaybeT(m))(Prelude["<<<"](Prelude.semigroupoidArr)(runMaybeT)(h)));
        };
    };
};
var liftCallCCMaybe = function (callCC) {
    return function (f) {
        return MaybeT(callCC(function (c) {
            return runMaybeT(f(function (a) {
                return MaybeT(c(new Data_Maybe.Just(a)));
            }));
        }));
    };
};
var monadMaybeT = function (__dict_Monad_3) {
    return new Prelude.Monad(function () {
        return applicativeMaybeT(__dict_Monad_3);
    }, function () {
        return bindMaybeT(__dict_Monad_3);
    });
};
var functorMaybeT = function (__dict_Monad_6) {
    return new Prelude.Functor(Prelude.liftA1(applicativeMaybeT(__dict_Monad_6)));
};
var bindMaybeT = function (__dict_Monad_7) {
    return new Prelude.Bind(function (x) {
        return function (f) {
            return MaybeT(Prelude[">>="](__dict_Monad_7["__superclass_Prelude.Bind_1"]())(runMaybeT(x))(function (_15) {
                if (_15 instanceof Data_Maybe.Nothing) {
                    return Prelude["return"](__dict_Monad_7)(Data_Maybe.Nothing.value);
                };
                if (_15 instanceof Data_Maybe.Just) {
                    return runMaybeT(f(_15.value0));
                };
                throw new Error("Failed pattern match");
            }));
        };
    }, function () {
        return applyMaybeT(__dict_Monad_7);
    });
};
var applyMaybeT = function (__dict_Monad_8) {
    return new Prelude.Apply(Prelude.ap(monadMaybeT(__dict_Monad_8)), function () {
        return functorMaybeT(__dict_Monad_8);
    });
};
var applicativeMaybeT = function (__dict_Monad_9) {
    return new Prelude.Applicative(function () {
        return applyMaybeT(__dict_Monad_9);
    }, Prelude["<<<"](Prelude.semigroupoidArr)(MaybeT)(Prelude["<<<"](Prelude.semigroupoidArr)(Prelude.pure(__dict_Monad_9["__superclass_Prelude.Applicative_0"]()))(Data_Maybe.Just.create)));
};
var altMaybeT = function (__dict_Monad_11) {
    return new Control_Alt.Alt(function (m1) {
        return function (m2) {
            return Prelude[">>="](__dict_Monad_11["__superclass_Prelude.Bind_1"]())(runMaybeT(m1))(function (_16) {
                if (_16 instanceof Data_Maybe.Nothing) {
                    return runMaybeT(m2);
                };
                return Prelude["return"](__dict_Monad_11)(_16);
            });
        };
    }, function () {
        return functorMaybeT(__dict_Monad_11);
    });
};
var plusMaybeT = function (__dict_Monad_0) {
    return new Control_Plus.Plus(function () {
        return altMaybeT(__dict_Monad_0);
    }, Prelude.pure(__dict_Monad_0["__superclass_Prelude.Applicative_0"]())(Data_Maybe.Nothing.value));
};
var alternativeMaybeT = function (__dict_Monad_10) {
    return new Control_Alternative.Alternative(function () {
        return plusMaybeT(__dict_Monad_10);
    }, function () {
        return applicativeMaybeT(__dict_Monad_10);
    });
};
var monadPlusMaybeT = function (__dict_Monad_2) {
    return new Control_MonadPlus.MonadPlus(function () {
        return alternativeMaybeT(__dict_Monad_2);
    }, function () {
        return monadMaybeT(__dict_Monad_2);
    });
};
module.exports = {
    MaybeT: MaybeT, 
    liftCallCCMaybe: liftCallCCMaybe, 
    liftPassMaybe: liftPassMaybe, 
    liftListenMaybe: liftListenMaybe, 
    liftCatchMaybe: liftCatchMaybe, 
    mapMaybeT: mapMaybeT, 
    runMaybeT: runMaybeT, 
    functorMaybeT: functorMaybeT, 
    applyMaybeT: applyMaybeT, 
    applicativeMaybeT: applicativeMaybeT, 
    bindMaybeT: bindMaybeT, 
    monadMaybeT: monadMaybeT, 
    monadTransMaybeT: monadTransMaybeT, 
    altMaybeT: altMaybeT, 
    plusMaybeT: plusMaybeT, 
    alternativeMaybeT: alternativeMaybeT, 
    monadPlusMaybeT: monadPlusMaybeT
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Monad":56,"Control.Monad.Trans":52,"Control.MonadPlus":57,"Control.Plus":58,"Data.Either":74,"Data.Maybe":89,"Data.Tuple":108,"Prelude":130}],47:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Tuple = require("Data.Tuple");
var Data_Monoid = require("Data.Monoid");
var Control_Monad_Trans = require("Control.Monad.Trans");
var RWST = function (x) {
    return x;
};
var runRWST = function (_305) {
    return _305;
};
var withRWST = function (f) {
    return function (m) {
        return function (r) {
            return function (s) {
                return Data_Tuple.uncurry(runRWST(m))(f(r)(s));
            };
        };
    };
};
var mkSee = function (__dict_Monoid_2) {
    return function (s) {
        return function (a) {
            return function (w) {
                return {
                    state: s, 
                    result: a, 
                    log: w
                };
            };
        };
    };
};
var monadTransRWST = function (__dict_Monoid_3) {
    return new Control_Monad_Trans.MonadTrans(function (__dict_Monad_4) {
        return function (m) {
            return function (_304) {
                return function (s) {
                    return Prelude[">>="](__dict_Monad_4["__superclass_Prelude.Bind_1"]())(m)(function (a) {
                        return Prelude["return"](__dict_Monad_4)(mkSee(__dict_Monoid_3)(s)(a)(Data_Monoid.mempty(__dict_Monoid_3)));
                    });
                };
            };
        };
    });
};
var mapRWST = function (f) {
    return function (m) {
        return function (r) {
            return function (s) {
                return f(runRWST(m)(r)(s));
            };
        };
    };
};
var functorRWST = function (__dict_Functor_5) {
    return new Prelude.Functor(function (f) {
        return function (m) {
            return function (r) {
                return function (s) {
                    return Prelude["<$>"](__dict_Functor_5)(function (see) {
                        var _1318 = {};
                        for (var _1319 in see) {
                            if (see.hasOwnProperty(_1319)) {
                                _1318[_1319] = see[_1319];
                            };
                        };
                        _1318.result = f(see.result);
                        return _1318;
                    })(runRWST(m)(r)(s));
                };
            };
        };
    });
};
var execRWST = function (__dict_Monad_6) {
    return function (m) {
        return function (r) {
            return function (s) {
                return Prelude[">>="](__dict_Monad_6["__superclass_Prelude.Bind_1"]())(runRWST(m)(r)(s))(function (see) {
                    return Prelude["return"](__dict_Monad_6)(new Data_Tuple.Tuple(see.state, see.log));
                });
            };
        };
    };
};
var evalRWST = function (__dict_Monad_7) {
    return function (m) {
        return function (r) {
            return function (s) {
                return Prelude[">>="](__dict_Monad_7["__superclass_Prelude.Bind_1"]())(runRWST(m)(r)(s))(function (see) {
                    return Prelude["return"](__dict_Monad_7)(new Data_Tuple.Tuple(see.result, see.log));
                });
            };
        };
    };
};
var applyRWST = function (__dict_Bind_10) {
    return function (__dict_Monoid_11) {
        return new Prelude.Apply(function (f) {
            return function (m) {
                return function (r) {
                    return function (s) {
                        return Prelude[">>="](__dict_Bind_10)(runRWST(f)(r)(s))(function (_301) {
                            return Prelude["<#>"]((__dict_Bind_10["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(runRWST(m)(r)(_301.state))(function (_300) {
                                return mkSee(__dict_Monoid_11)(_300.state)(_301.result(_300.result))(Prelude["++"](__dict_Monoid_11["__superclass_Prelude.Semigroup_0"]())(_301.log)(_300.log));
                            });
                        });
                    };
                };
            };
        }, function () {
            return functorRWST((__dict_Bind_10["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]());
        });
    };
};
var bindRWST = function (__dict_Bind_8) {
    return function (__dict_Monoid_9) {
        return new Prelude.Bind(function (m) {
            return function (f) {
                return function (r) {
                    return function (s) {
                        return Prelude[">>="](__dict_Bind_8)(runRWST(m)(r)(s))(function (_302) {
                            return Prelude["<#>"]((__dict_Bind_8["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(runRWST(f(_302.result))(r)(_302.state))(function (see$prime) {
                                var _1329 = {};
                                for (var _1330 in see$prime) {
                                    if (see$prime.hasOwnProperty(_1330)) {
                                        _1329[_1330] = see$prime[_1330];
                                    };
                                };
                                _1329.log = Prelude["++"](__dict_Monoid_9["__superclass_Prelude.Semigroup_0"]())(_302.log)(see$prime.log);
                                return _1329;
                            });
                        });
                    };
                };
            };
        }, function () {
            return applyRWST(__dict_Bind_8)(__dict_Monoid_9);
        });
    };
};
var applicativeRWST = function (__dict_Monad_12) {
    return function (__dict_Monoid_13) {
        return new Prelude.Applicative(function () {
            return applyRWST(__dict_Monad_12["__superclass_Prelude.Bind_1"]())(__dict_Monoid_13);
        }, function (a) {
            return function (_303) {
                return function (s) {
                    return Prelude.pure(__dict_Monad_12["__superclass_Prelude.Applicative_0"]())(mkSee(__dict_Monoid_13)(s)(a)(Data_Monoid.mempty(__dict_Monoid_13)));
                };
            };
        });
    };
};
var monadRWST = function (__dict_Monad_0) {
    return function (__dict_Monoid_1) {
        return new Prelude.Monad(function () {
            return applicativeRWST(__dict_Monad_0)(__dict_Monoid_1);
        }, function () {
            return bindRWST(__dict_Monad_0["__superclass_Prelude.Bind_1"]())(__dict_Monoid_1);
        });
    };
};
module.exports = {
    RWST: RWST, 
    withRWST: withRWST, 
    mapRWST: mapRWST, 
    execRWST: execRWST, 
    evalRWST: evalRWST, 
    runRWST: runRWST, 
    mkSee: mkSee, 
    functorRWST: functorRWST, 
    applyRWST: applyRWST, 
    bindRWST: bindRWST, 
    applicativeRWST: applicativeRWST, 
    monadRWST: monadRWST, 
    monadTransRWST: monadTransRWST
};

},{"Control.Monad.Trans":52,"Data.Monoid":96,"Data.Tuple":108,"Prelude":130}],48:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Identity = require("Data.Identity");
var Control_Monad_RWS_Trans = require("Control.Monad.RWS.Trans");
var Data_Monoid = require("Data.Monoid");
var Data_Tuple = require("Data.Tuple");
var writer = function (__dict_Applicative_0) {
    return function (_534) {
        return function (_528) {
            return function (s) {
                return Prelude.pure(__dict_Applicative_0)({
                    state: s, 
                    result: _534.value0, 
                    log: _534.value1
                });
            };
        };
    };
};
var withRWS = Control_Monad_RWS_Trans.withRWST;
var tell = function (__dict_Applicative_1) {
    return function (w) {
        return writer(__dict_Applicative_1)(new Data_Tuple.Tuple(Prelude.unit, w));
    };
};
var state = function (__dict_Applicative_2) {
    return function (__dict_Monoid_3) {
        return function (f) {
            return function (_532) {
                return function (s) {
                    var _1977 = f(s);
                    return Prelude.pure(__dict_Applicative_2)(Control_Monad_RWS_Trans.mkSee(__dict_Monoid_3)(_1977.value1)(_1977.value0)(Data_Monoid.mempty(__dict_Monoid_3)));
                };
            };
        };
    };
};
var rws = function (f) {
    return function (r) {
        return function (s) {
            return Prelude["return"](Data_Identity.monadIdentity)(f(r)(s));
        };
    };
};
var runRWS = function (m) {
    return function (r) {
        return function (s) {
            return Data_Identity.runIdentity(Control_Monad_RWS_Trans.runRWST(m)(r)(s));
        };
    };
};
var reader = function (__dict_Applicative_4) {
    return function (__dict_Monoid_5) {
        return function (f) {
            return function (r) {
                return function (s) {
                    return Prelude.pure(__dict_Applicative_4)(Control_Monad_RWS_Trans.mkSee(__dict_Monoid_5)(s)(f(r))(Data_Monoid.mempty(__dict_Monoid_5)));
                };
            };
        };
    };
};
var put = function (__dict_Applicative_6) {
    return function (__dict_Monoid_7) {
        return function (s) {
            return state(__dict_Applicative_6)(__dict_Monoid_7)(function (_533) {
                return new Data_Tuple.Tuple(Prelude.unit, s);
            });
        };
    };
};
var pass = function (__dict_Monad_8) {
    return function (m) {
        return function (r) {
            return function (s) {
                return Prelude[">>="](__dict_Monad_8["__superclass_Prelude.Bind_1"]())(Control_Monad_RWS_Trans.runRWST(m)(r)(s))(function (_530) {
                    return Prelude.pure(__dict_Monad_8["__superclass_Prelude.Applicative_0"]())({
                        state: _530.state, 
                        result: _530.result.value0, 
                        log: _530.result.value1(_530.log)
                    });
                });
            };
        };
    };
};
var modify = function (__dict_Applicative_9) {
    return function (__dict_Monoid_10) {
        return function (f) {
            return state(__dict_Applicative_9)(__dict_Monoid_10)(function (s) {
                return new Data_Tuple.Tuple(Prelude.unit, f(s));
            });
        };
    };
};
var mapRWS = function (f) {
    return Control_Monad_RWS_Trans.mapRWST(Prelude[">>>"](Prelude.semigroupoidArr)(Data_Identity.runIdentity)(Prelude[">>>"](Prelude.semigroupoidArr)(f)(Data_Identity.Identity)));
};
var local = function (f) {
    return function (m) {
        return function (r) {
            return function (s) {
                return Control_Monad_RWS_Trans.runRWST(m)(f(r))(s);
            };
        };
    };
};
var listens = function (__dict_Monad_11) {
    return function (f) {
        return function (m) {
            return function (r) {
                return function (s) {
                    return Prelude[">>="](__dict_Monad_11["__superclass_Prelude.Bind_1"]())(Control_Monad_RWS_Trans.runRWST(m)(r)(s))(function (_531) {
                        return Prelude.pure(__dict_Monad_11["__superclass_Prelude.Applicative_0"]())({
                            state: _531.state, 
                            result: new Data_Tuple.Tuple(_531.result, f(_531.log)), 
                            log: _531.log
                        });
                    });
                };
            };
        };
    };
};
var listen = function (__dict_Monad_12) {
    return function (m) {
        return function (r) {
            return function (s) {
                return Prelude[">>="](__dict_Monad_12["__superclass_Prelude.Bind_1"]())(Control_Monad_RWS_Trans.runRWST(m)(r)(s))(function (_529) {
                    return Prelude.pure(__dict_Monad_12["__superclass_Prelude.Applicative_0"]())({
                        state: _529.state, 
                        result: new Data_Tuple.Tuple(_529.result, _529.log), 
                        log: _529.log
                    });
                });
            };
        };
    };
};
var gets = function (__dict_Applicative_13) {
    return function (__dict_Monoid_14) {
        return function (f) {
            return state(__dict_Applicative_13)(__dict_Monoid_14)(function (s) {
                return new Data_Tuple.Tuple(f(s), s);
            });
        };
    };
};
var get = function (__dict_Applicative_15) {
    return function (__dict_Monoid_16) {
        return state(__dict_Applicative_15)(__dict_Monoid_16)(function (s) {
            return new Data_Tuple.Tuple(s, s);
        });
    };
};
var execRWS = function (m) {
    return function (r) {
        return function (s) {
            return Data_Identity.runIdentity(Control_Monad_RWS_Trans.execRWST(Data_Identity.monadIdentity)(m)(r)(s));
        };
    };
};
var evalRWS = function (m) {
    return function (r) {
        return function (s) {
            return Data_Identity.runIdentity(Control_Monad_RWS_Trans.evalRWST(Data_Identity.monadIdentity)(m)(r)(s));
        };
    };
};
var censor = function (__dict_Monad_17) {
    return function (f) {
        return function (m) {
            return function (r) {
                return function (s) {
                    return Prelude[">>="](__dict_Monad_17["__superclass_Prelude.Bind_1"]())(Control_Monad_RWS_Trans.runRWST(m)(r)(s))(function (see) {
                        return Prelude.pure(__dict_Monad_17["__superclass_Prelude.Applicative_0"]())((function () {
                            var _1995 = {};
                            for (var _1996 in see) {
                                if (see.hasOwnProperty(_1996)) {
                                    _1995[_1996] = see[_1996];
                                };
                            };
                            _1995.log = f(see.log);
                            return _1995;
                        })());
                    });
                };
            };
        };
    };
};
var ask = function (__dict_Applicative_18) {
    return function (__dict_Monoid_19) {
        return function (r) {
            return function (s) {
                return Prelude.pure(__dict_Applicative_18)(Control_Monad_RWS_Trans.mkSee(__dict_Monoid_19)(s)(r)(Data_Monoid.mempty(__dict_Monoid_19)));
            };
        };
    };
};
module.exports = {
    modify: modify, 
    put: put, 
    gets: gets, 
    get: get, 
    state: state, 
    censor: censor, 
    listens: listens, 
    tell: tell, 
    pass: pass, 
    listen: listen, 
    writer: writer, 
    reader: reader, 
    local: local, 
    ask: ask, 
    withRWS: withRWS, 
    mapRWS: mapRWS, 
    execRWS: execRWS, 
    evalRWS: evalRWS, 
    runRWS: runRWS, 
    rws: rws
};

},{"Control.Monad.RWS.Trans":47,"Data.Identity":85,"Data.Monoid":96,"Data.Tuple":108,"Prelude":130}],49:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Control_MonadPlus = require("Control.MonadPlus");
var ReaderT = function (x) {
    return x;
};
var runReaderT = function (_122) {
    return _122;
};
var withReaderT = function (f) {
    return function (m) {
        return ReaderT(Prelude["<<<"](Prelude.semigroupoidArr)(runReaderT(m))(f));
    };
};
var mapReaderT = function (f) {
    return function (m) {
        return ReaderT(Prelude["<<<"](Prelude.semigroupoidArr)(f)(runReaderT(m)));
    };
};
var liftReaderT = function (m) {
    return Prelude["const"](m);
};
var monadTransReaderT = new Control_Monad_Trans.MonadTrans(function (__dict_Monad_2) {
    return liftReaderT;
});
var liftCatchReader = function ($$catch) {
    return function (m) {
        return function (h) {
            return ReaderT(function (r) {
                return $$catch(runReaderT(m)(r))(function (e) {
                    return runReaderT(h(e))(r);
                });
            });
        };
    };
};
var liftCallCCReader = function (callCC) {
    return function (f) {
        return ReaderT(function (r) {
            return callCC(function (c) {
                return runReaderT(f(function (a) {
                    return ReaderT(Prelude["const"](c(a)));
                }))(r);
            });
        });
    };
};
var functorReaderT = function (__dict_Functor_4) {
    return new Prelude.Functor(function (f) {
        return mapReaderT(Prelude["<$>"](__dict_Functor_4)(f));
    });
};
var applyReaderT = function (__dict_Applicative_6) {
    return new Prelude.Apply(function (f) {
        return function (v) {
            return function (r) {
                return Prelude["<*>"](__dict_Applicative_6["__superclass_Prelude.Apply_0"]())(runReaderT(f)(r))(runReaderT(v)(r));
            };
        };
    }, function () {
        return functorReaderT((__dict_Applicative_6["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]());
    });
};
var bindReaderT = function (__dict_Monad_5) {
    return new Prelude.Bind(function (m) {
        return function (k) {
            return function (r) {
                return Prelude[">>="](__dict_Monad_5["__superclass_Prelude.Bind_1"]())(runReaderT(m)(r))(function (_8) {
                    return runReaderT(k(_8))(r);
                });
            };
        };
    }, function () {
        return applyReaderT(__dict_Monad_5["__superclass_Prelude.Applicative_0"]());
    });
};
var applicativeReaderT = function (__dict_Applicative_7) {
    return new Prelude.Applicative(function () {
        return applyReaderT(__dict_Applicative_7);
    }, Prelude["<<<"](Prelude.semigroupoidArr)(liftReaderT)(Prelude.pure(__dict_Applicative_7)));
};
var monadReaderT = function (__dict_Monad_0) {
    return new Prelude.Monad(function () {
        return applicativeReaderT(__dict_Monad_0["__superclass_Prelude.Applicative_0"]());
    }, function () {
        return bindReaderT(__dict_Monad_0);
    });
};
var altReaderT = function (__dict_Alt_9) {
    return new Control_Alt.Alt(function (m) {
        return function (n) {
            return function (r) {
                return Control_Alt["<|>"](__dict_Alt_9)(runReaderT(m)(r))(runReaderT(n)(r));
            };
        };
    }, function () {
        return functorReaderT(__dict_Alt_9["__superclass_Prelude.Functor_0"]());
    });
};
var plusReaderT = function (__dict_Plus_3) {
    return new Control_Plus.Plus(function () {
        return altReaderT(__dict_Plus_3["__superclass_Control.Alt.Alt_0"]());
    }, liftReaderT(Control_Plus.empty(__dict_Plus_3)));
};
var alternativeReaderT = function (__dict_Alternative_8) {
    return new Control_Alternative.Alternative(function () {
        return plusReaderT(__dict_Alternative_8["__superclass_Control.Plus.Plus_1"]());
    }, function () {
        return applicativeReaderT(__dict_Alternative_8["__superclass_Prelude.Applicative_0"]());
    });
};
var monadPlusReaderT = function (__dict_MonadPlus_1) {
    return new Control_MonadPlus.MonadPlus(function () {
        return alternativeReaderT(__dict_MonadPlus_1["__superclass_Control.Alternative.Alternative_1"]());
    }, function () {
        return monadReaderT(__dict_MonadPlus_1["__superclass_Prelude.Monad_0"]());
    });
};
module.exports = {
    ReaderT: ReaderT, 
    liftCallCCReader: liftCallCCReader, 
    liftCatchReader: liftCatchReader, 
    liftReaderT: liftReaderT, 
    mapReaderT: mapReaderT, 
    withReaderT: withReaderT, 
    runReaderT: runReaderT, 
    functorReaderT: functorReaderT, 
    applyReaderT: applyReaderT, 
    applicativeReaderT: applicativeReaderT, 
    altReaderT: altReaderT, 
    plusReaderT: plusReaderT, 
    alternativeReaderT: alternativeReaderT, 
    bindReaderT: bindReaderT, 
    monadReaderT: monadReaderT, 
    monadPlusReaderT: monadPlusReaderT, 
    monadTransReaderT: monadTransReaderT
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Monad.Trans":52,"Control.MonadPlus":57,"Control.Plus":58,"Prelude":130}],50:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Control_Monad_Eff = require("Control.Monad.Eff");
var Prelude = require("Prelude");

    function newSTRef(val) {
      return function() {
        return { value: val };
      };
    }
    ;

    function readSTRef(ref) {
      return function() {
        return ref.value;
      };
    }
    ;

    function modifySTRef(ref) {
      return function(f) {
        return function() {
          return ref.value = f(ref.value);
        };
      };
    }
    ;

    function writeSTRef(ref) {
      return function(a) {
        return function() {
          return ref.value = a;
        };
      };
    }
    ;

    function runST(f) {
      return f;
    }
    ;
var pureST = function (st) {
    return Control_Monad_Eff.runPure(runST(st));
};
module.exports = {
    pureST: pureST, 
    runST: runST, 
    writeSTRef: writeSTRef, 
    modifySTRef: modifySTRef, 
    readSTRef: readSTRef, 
    newSTRef: newSTRef
};

},{"Control.Monad.Eff":40,"Prelude":130}],51:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Tuple = require("Data.Tuple");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Control_MonadPlus = require("Control.MonadPlus");
var Control_Lazy = require("Control.Lazy");
var StateT = function (x) {
    return x;
};
var runStateT = function (_308) {
    return _308;
};
var withStateT = function (f) {
    return function (s) {
        return StateT(Prelude["<<<"](Prelude.semigroupoidArr)(runStateT(s))(f));
    };
};
var monadTransStateT = new Control_Monad_Trans.MonadTrans(function (__dict_Monad_2) {
    return function (m) {
        return function (s) {
            return Prelude[">>="](__dict_Monad_2["__superclass_Prelude.Bind_1"]())(m)(function (_20) {
                return Prelude["return"](__dict_Monad_2)(new Data_Tuple.Tuple(_20, s));
            });
        };
    };
});
var mapStateT = function (f) {
    return function (m) {
        return StateT(Prelude["<<<"](Prelude.semigroupoidArr)(f)(runStateT(m)));
    };
};
var liftPassState = function (__dict_Monad_5) {
    return function (pass) {
        return function (m) {
            return StateT(function (s) {
                return pass(Prelude[">>="](__dict_Monad_5["__superclass_Prelude.Bind_1"]())(runStateT(m)(s))(function (_22) {
                    return Prelude["return"](__dict_Monad_5)(new Data_Tuple.Tuple(new Data_Tuple.Tuple(_22.value0.value0, _22.value1), _22.value0.value1));
                }));
            });
        };
    };
};
var liftListenState = function (__dict_Monad_6) {
    return function (listen) {
        return function (m) {
            return StateT(function (s) {
                return Prelude[">>="](__dict_Monad_6["__superclass_Prelude.Bind_1"]())(listen(runStateT(m)(s)))(function (_21) {
                    return Prelude["return"](__dict_Monad_6)(new Data_Tuple.Tuple(new Data_Tuple.Tuple(_21.value0.value0, _21.value1), _21.value0.value1));
                });
            });
        };
    };
};
var liftCatchState = function ($$catch) {
    return function (m) {
        return function (h) {
            return StateT(function (s) {
                return $$catch(runStateT(m)(s))(function (e) {
                    return runStateT(h(e))(s);
                });
            });
        };
    };
};
var liftCallCCState$prime = function (callCC) {
    return function (f) {
        return StateT(function (s) {
            return callCC(function (c) {
                return runStateT(f(function (a) {
                    return StateT(function (s$prime) {
                        return c(new Data_Tuple.Tuple(a, s$prime));
                    });
                }))(s);
            });
        });
    };
};
var liftCallCCState = function (callCC) {
    return function (f) {
        return StateT(function (s) {
            return callCC(function (c) {
                return runStateT(f(function (a) {
                    return StateT(function (_307) {
                        return c(new Data_Tuple.Tuple(a, s));
                    });
                }))(s);
            });
        });
    };
};
var lazy1StateT = new Control_Lazy.Lazy1(function (f) {
    return StateT(function (s) {
        return runStateT(f(Prelude.unit))(s);
    });
});
var execStateT = function (__dict_Apply_8) {
    return function (m) {
        return function (s) {
            return Prelude["<$>"](__dict_Apply_8["__superclass_Prelude.Functor_0"]())(Data_Tuple.snd)(runStateT(m)(s));
        };
    };
};
var evalStateT = function (__dict_Apply_9) {
    return function (m) {
        return function (s) {
            return Prelude["<$>"](__dict_Apply_9["__superclass_Prelude.Functor_0"]())(Data_Tuple.fst)(runStateT(m)(s));
        };
    };
};
var monadStateT = function (__dict_Monad_3) {
    return new Prelude.Monad(function () {
        return applicativeStateT(__dict_Monad_3);
    }, function () {
        return bindStateT(__dict_Monad_3);
    });
};
var functorStateT = function (__dict_Monad_7) {
    return new Prelude.Functor(Prelude.liftM1(monadStateT(__dict_Monad_7)));
};
var bindStateT = function (__dict_Monad_10) {
    return new Prelude.Bind(function (_309) {
        return function (f) {
            return function (s) {
                return Prelude[">>="](__dict_Monad_10["__superclass_Prelude.Bind_1"]())(_309(s))(function (_19) {
                    return runStateT(f(_19.value0))(_19.value1);
                });
            };
        };
    }, function () {
        return applyStateT(__dict_Monad_10);
    });
};
var applyStateT = function (__dict_Monad_11) {
    return new Prelude.Apply(Prelude.ap(monadStateT(__dict_Monad_11)), function () {
        return functorStateT(__dict_Monad_11);
    });
};
var applicativeStateT = function (__dict_Monad_12) {
    return new Prelude.Applicative(function () {
        return applyStateT(__dict_Monad_12);
    }, function (a) {
        return StateT(function (s) {
            return Prelude["return"](__dict_Monad_12)(new Data_Tuple.Tuple(a, s));
        });
    });
};
var altStateT = function (__dict_Monad_15) {
    return function (__dict_Alt_16) {
        return new Control_Alt.Alt(function (x) {
            return function (y) {
                return StateT(function (s) {
                    return Control_Alt["<|>"](__dict_Alt_16)(runStateT(x)(s))(runStateT(y)(s));
                });
            };
        }, function () {
            return functorStateT(__dict_Monad_15);
        });
    };
};
var plusStateT = function (__dict_Monad_0) {
    return function (__dict_Plus_1) {
        return new Control_Plus.Plus(function () {
            return altStateT(__dict_Monad_0)(__dict_Plus_1["__superclass_Control.Alt.Alt_0"]());
        }, StateT(function (_306) {
            return Control_Plus.empty(__dict_Plus_1);
        }));
    };
};
var alternativeStateT = function (__dict_Monad_13) {
    return function (__dict_Alternative_14) {
        return new Control_Alternative.Alternative(function () {
            return plusStateT(__dict_Monad_13)(__dict_Alternative_14["__superclass_Control.Plus.Plus_1"]());
        }, function () {
            return applicativeStateT(__dict_Monad_13);
        });
    };
};
var monadPlusStateT = function (__dict_MonadPlus_4) {
    return new Control_MonadPlus.MonadPlus(function () {
        return alternativeStateT(__dict_MonadPlus_4["__superclass_Prelude.Monad_0"]())(__dict_MonadPlus_4["__superclass_Control.Alternative.Alternative_1"]());
    }, function () {
        return monadStateT(__dict_MonadPlus_4["__superclass_Prelude.Monad_0"]());
    });
};
module.exports = {
    StateT: StateT, 
    "liftCallCCState'": liftCallCCState$prime, 
    liftCallCCState: liftCallCCState, 
    liftPassState: liftPassState, 
    liftListenState: liftListenState, 
    liftCatchState: liftCatchState, 
    withStateT: withStateT, 
    mapStateT: mapStateT, 
    execStateT: execStateT, 
    evalStateT: evalStateT, 
    runStateT: runStateT, 
    functorStateT: functorStateT, 
    applyStateT: applyStateT, 
    applicativeStateT: applicativeStateT, 
    altStateT: altStateT, 
    plusStateT: plusStateT, 
    alternativeStateT: alternativeStateT, 
    bindStateT: bindStateT, 
    monadStateT: monadStateT, 
    monadPlusStateT: monadPlusStateT, 
    monadTransStateT: monadTransStateT, 
    lazy1StateT: lazy1StateT
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Lazy":33,"Control.Monad.Trans":52,"Control.MonadPlus":57,"Control.Plus":58,"Data.Tuple":108,"Prelude":130}],52:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var MonadTrans = function (lift) {
    this.lift = lift;
};
var lift = function (dict) {
    return dict.lift;
};
module.exports = {
    MonadTrans: MonadTrans, 
    lift: lift
};

},{"Prelude":130}],53:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Writer_Trans = require("Control.Monad.Writer.Trans");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Control_Monad_Error_Trans = require("Control.Monad.Error.Trans");
var Control_Monad_Maybe_Trans = require("Control.Monad.Maybe.Trans");
var Control_Monad_State_Trans = require("Control.Monad.State.Trans");
var Control_Monad_Reader_Trans = require("Control.Monad.Reader.Trans");
var Control_Monad_RWS = require("Control.Monad.RWS");
var Control_Monad_Error = require("Control.Monad.Error");
var Control_Monad_RWS_Trans = require("Control.Monad.RWS.Trans");
var Data_Monoid = require("Data.Monoid");
var Data_Tuple = require("Data.Tuple");
var MonadWriter = function (listen, pass, writer) {
    this.listen = listen;
    this.pass = pass;
    this.writer = writer;
};
var writer = function (dict) {
    return dict.writer;
};
var tell = function (__dict_Monoid_0) {
    return function (__dict_Monad_1) {
        return function (__dict_MonadWriter_2) {
            return function (w) {
                return writer(__dict_MonadWriter_2)(new Data_Tuple.Tuple(Prelude.unit, w));
            };
        };
    };
};
var pass = function (dict) {
    return dict.pass;
};
var monadWriterWriterT = function (__dict_Monoid_3) {
    return function (__dict_Monad_4) {
        return new MonadWriter(function (m) {
            return Control_Monad_Writer_Trans.WriterT(Prelude[">>="](__dict_Monad_4["__superclass_Prelude.Bind_1"]())(Control_Monad_Writer_Trans.runWriterT(m))(function (_35) {
                return Prelude["return"](__dict_Monad_4)(new Data_Tuple.Tuple(new Data_Tuple.Tuple(_35.value0, _35.value1), _35.value1));
            }));
        }, function (m) {
            return Control_Monad_Writer_Trans.WriterT(Prelude[">>="](__dict_Monad_4["__superclass_Prelude.Bind_1"]())(Control_Monad_Writer_Trans.runWriterT(m))(function (_36) {
                return Prelude["return"](__dict_Monad_4)(new Data_Tuple.Tuple(_36.value0.value0, _36.value0.value1(_36.value1)));
            }));
        }, Prelude["<<<"](Prelude.semigroupoidArr)(Control_Monad_Writer_Trans.WriterT)(Prelude["return"](__dict_Monad_4)));
    };
};
var monadWriterRWST = function (__dict_Monad_5) {
    return function (__dict_Monoid_6) {
        return new MonadWriter(Control_Monad_RWS.listen(__dict_Monad_5), Control_Monad_RWS.pass(__dict_Monad_5), Control_Monad_RWS.writer(__dict_Monad_5["__superclass_Prelude.Applicative_0"]()));
    };
};
var listen = function (dict) {
    return dict.listen;
};
var listens = function (__dict_Monoid_7) {
    return function (__dict_Monad_8) {
        return function (__dict_MonadWriter_9) {
            return function (f) {
                return function (m) {
                    return Prelude[">>="](__dict_Monad_8["__superclass_Prelude.Bind_1"]())(listen(__dict_MonadWriter_9)(m))(function (_33) {
                        return Prelude["return"](__dict_Monad_8)(new Data_Tuple.Tuple(_33.value0, f(_33.value1)));
                    });
                };
            };
        };
    };
};
var monadWriterErrorT = function (__dict_Monad_10) {
    return function (__dict_MonadWriter_11) {
        return new MonadWriter(Control_Monad_Error_Trans.liftListenError(__dict_Monad_10)(listen(__dict_MonadWriter_11)), Control_Monad_Error_Trans.liftPassError(__dict_Monad_10)(pass(__dict_MonadWriter_11)), function (wd) {
            return Control_Monad_Trans.lift(Control_Monad_Error_Trans.monadTransErrorT)(__dict_Monad_10)(writer(__dict_MonadWriter_11)(wd));
        });
    };
};
var monadWriterMaybeT = function (__dict_Monad_12) {
    return function (__dict_MonadWriter_13) {
        return new MonadWriter(Control_Monad_Maybe_Trans.liftListenMaybe(__dict_Monad_12)(listen(__dict_MonadWriter_13)), Control_Monad_Maybe_Trans.liftPassMaybe(__dict_Monad_12)(pass(__dict_MonadWriter_13)), function (wd) {
            return Control_Monad_Trans.lift(Control_Monad_Maybe_Trans.monadTransMaybeT)(__dict_Monad_12)(writer(__dict_MonadWriter_13)(wd));
        });
    };
};
var monadWriterReaderT = function (__dict_Monad_14) {
    return function (__dict_MonadWriter_15) {
        return new MonadWriter(Control_Monad_Reader_Trans.mapReaderT(listen(__dict_MonadWriter_15)), Control_Monad_Reader_Trans.mapReaderT(pass(__dict_MonadWriter_15)), function (wd) {
            return Control_Monad_Trans.lift(Control_Monad_Reader_Trans.monadTransReaderT)(__dict_Monad_14)(writer(__dict_MonadWriter_15)(wd));
        });
    };
};
var monadWriterStateT = function (__dict_Monad_16) {
    return function (__dict_MonadWriter_17) {
        return new MonadWriter(Control_Monad_State_Trans.liftListenState(__dict_Monad_16)(listen(__dict_MonadWriter_17)), Control_Monad_State_Trans.liftPassState(__dict_Monad_16)(pass(__dict_MonadWriter_17)), function (wd) {
            return Control_Monad_Trans.lift(Control_Monad_State_Trans.monadTransStateT)(__dict_Monad_16)(writer(__dict_MonadWriter_17)(wd));
        });
    };
};
var censor = function (__dict_Monoid_18) {
    return function (__dict_Monad_19) {
        return function (__dict_MonadWriter_20) {
            return function (f) {
                return function (m) {
                    return pass(__dict_MonadWriter_20)(Prelude[">>="](__dict_Monad_19["__superclass_Prelude.Bind_1"]())(m)(function (_34) {
                        return Prelude["return"](__dict_Monad_19)(new Data_Tuple.Tuple(_34, f));
                    }));
                };
            };
        };
    };
};
module.exports = {
    MonadWriter: MonadWriter, 
    censor: censor, 
    listens: listens, 
    tell: tell, 
    pass: pass, 
    listen: listen, 
    writer: writer, 
    monadWriterWriterT: monadWriterWriterT, 
    monadWriterErrorT: monadWriterErrorT, 
    monadWriterMaybeT: monadWriterMaybeT, 
    monadWriterStateT: monadWriterStateT, 
    monadWriterReaderT: monadWriterReaderT, 
    monadWriterRWST: monadWriterRWST
};

},{"Control.Monad.Error":43,"Control.Monad.Error.Trans":42,"Control.Monad.Maybe.Trans":46,"Control.Monad.RWS":48,"Control.Monad.RWS.Trans":47,"Control.Monad.Reader.Trans":49,"Control.Monad.State.Trans":51,"Control.Monad.Trans":52,"Control.Monad.Writer.Trans":54,"Data.Monoid":96,"Data.Tuple":108,"Prelude":130}],54:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Tuple = require("Data.Tuple");
var Data_Monoid = require("Data.Monoid");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Control_MonadPlus = require("Control.MonadPlus");
var WriterT = function (x) {
    return x;
};
var runWriterT = function (_311) {
    return _311;
};
var monadTransWriterT = function (__dict_Monoid_4) {
    return new Control_Monad_Trans.MonadTrans(function (__dict_Monad_5) {
        return function (m) {
            return WriterT(Prelude[">>="](__dict_Monad_5["__superclass_Prelude.Bind_1"]())(m)(function (_25) {
                return Prelude["return"](__dict_Monad_5)(new Data_Tuple.Tuple(_25, Data_Monoid.mempty(__dict_Monoid_4)));
            }));
        };
    });
};
var mapWriterT = function (f) {
    return function (m) {
        return WriterT(f(runWriterT(m)));
    };
};
var liftCatchWriter = function ($$catch) {
    return function (m) {
        return function (h) {
            return WriterT($$catch(runWriterT(m))(function (e) {
                return runWriterT(h(e));
            }));
        };
    };
};
var liftCallCCWriter = function (__dict_Monoid_8) {
    return function (callCC) {
        return function (f) {
            return WriterT(callCC(function (c) {
                return runWriterT(f(function (a) {
                    return WriterT(c(new Data_Tuple.Tuple(a, Data_Monoid.mempty(__dict_Monoid_8))));
                }));
            }));
        };
    };
};
var functorWriterT = function (__dict_Functor_9) {
    return new Prelude.Functor(function (f) {
        return mapWriterT(Prelude["<$>"](__dict_Functor_9)(function (_310) {
            return new Data_Tuple.Tuple(f(_310.value0), _310.value1);
        }));
    });
};
var execWriterT = function (__dict_Apply_10) {
    return function (m) {
        return Prelude["<$>"](__dict_Apply_10["__superclass_Prelude.Functor_0"]())(Data_Tuple.snd)(runWriterT(m));
    };
};
var applyWriterT = function (__dict_Monoid_13) {
    return function (__dict_Apply_14) {
        return new Prelude.Apply(function (f) {
            return function (v) {
                return WriterT((function () {
                    var k = function (_312) {
                        return function (_313) {
                            return new Data_Tuple.Tuple(_312.value0(_313.value0), Prelude["<>"](__dict_Monoid_13["__superclass_Prelude.Semigroup_0"]())(_312.value1)(_313.value1));
                        };
                    };
                    return Prelude["<*>"](__dict_Apply_14)(Prelude["<$>"](__dict_Apply_14["__superclass_Prelude.Functor_0"]())(k)(runWriterT(f)))(runWriterT(v));
                })());
            };
        }, function () {
            return functorWriterT(__dict_Apply_14["__superclass_Prelude.Functor_0"]());
        });
    };
};
var bindWriterT = function (__dict_Monoid_11) {
    return function (__dict_Monad_12) {
        return new Prelude.Bind(function (m) {
            return function (k) {
                return WriterT(Prelude[">>="](__dict_Monad_12["__superclass_Prelude.Bind_1"]())(runWriterT(m))(function (_24) {
                    return Prelude[">>="](__dict_Monad_12["__superclass_Prelude.Bind_1"]())(runWriterT(k(_24.value0)))(function (_23) {
                        return Prelude["return"](__dict_Monad_12)(new Data_Tuple.Tuple(_23.value0, Prelude["<>"](__dict_Monoid_11["__superclass_Prelude.Semigroup_0"]())(_24.value1)(_23.value1)));
                    });
                }));
            };
        }, function () {
            return applyWriterT(__dict_Monoid_11)((__dict_Monad_12["__superclass_Prelude.Applicative_0"]())["__superclass_Prelude.Apply_0"]());
        });
    };
};
var applicativeWriterT = function (__dict_Monoid_15) {
    return function (__dict_Applicative_16) {
        return new Prelude.Applicative(function () {
            return applyWriterT(__dict_Monoid_15)(__dict_Applicative_16["__superclass_Prelude.Apply_0"]());
        }, function (a) {
            return WriterT(Prelude.pure(__dict_Applicative_16)(new Data_Tuple.Tuple(a, Data_Monoid.mempty(__dict_Monoid_15))));
        });
    };
};
var monadWriterT = function (__dict_Monoid_2) {
    return function (__dict_Monad_3) {
        return new Prelude.Monad(function () {
            return applicativeWriterT(__dict_Monoid_2)(__dict_Monad_3["__superclass_Prelude.Applicative_0"]());
        }, function () {
            return bindWriterT(__dict_Monoid_2)(__dict_Monad_3);
        });
    };
};
var altWriterT = function (__dict_Monoid_19) {
    return function (__dict_Alt_20) {
        return new Control_Alt.Alt(function (m) {
            return function (n) {
                return WriterT(Control_Alt["<|>"](__dict_Alt_20)(runWriterT(m))(runWriterT(n)));
            };
        }, function () {
            return functorWriterT(__dict_Alt_20["__superclass_Prelude.Functor_0"]());
        });
    };
};
var plusWriterT = function (__dict_Monoid_0) {
    return function (__dict_Plus_1) {
        return new Control_Plus.Plus(function () {
            return altWriterT(__dict_Monoid_0)(__dict_Plus_1["__superclass_Control.Alt.Alt_0"]());
        }, Control_Plus.empty(__dict_Plus_1));
    };
};
var alternativeWriterT = function (__dict_Monoid_17) {
    return function (__dict_Alternative_18) {
        return new Control_Alternative.Alternative(function () {
            return plusWriterT(__dict_Monoid_17)(__dict_Alternative_18["__superclass_Control.Plus.Plus_1"]());
        }, function () {
            return applicativeWriterT(__dict_Monoid_17)(__dict_Alternative_18["__superclass_Prelude.Applicative_0"]());
        });
    };
};
var monadPlusWriterT = function (__dict_Monoid_6) {
    return function (__dict_MonadPlus_7) {
        return new Control_MonadPlus.MonadPlus(function () {
            return alternativeWriterT(__dict_Monoid_6)(__dict_MonadPlus_7["__superclass_Control.Alternative.Alternative_1"]());
        }, function () {
            return monadWriterT(__dict_Monoid_6)(__dict_MonadPlus_7["__superclass_Prelude.Monad_0"]());
        });
    };
};
module.exports = {
    WriterT: WriterT, 
    liftCallCCWriter: liftCallCCWriter, 
    liftCatchWriter: liftCatchWriter, 
    mapWriterT: mapWriterT, 
    execWriterT: execWriterT, 
    runWriterT: runWriterT, 
    functorWriterT: functorWriterT, 
    applyWriterT: applyWriterT, 
    applicativeWriterT: applicativeWriterT, 
    altWriterT: altWriterT, 
    plusWriterT: plusWriterT, 
    alternativeWriterT: alternativeWriterT, 
    bindWriterT: bindWriterT, 
    monadWriterT: monadWriterT, 
    monadPlusWriterT: monadPlusWriterT, 
    monadTransWriterT: monadTransWriterT
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Monad.Trans":52,"Control.MonadPlus":57,"Control.Plus":58,"Data.Monoid":96,"Data.Tuple":108,"Prelude":130}],55:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Identity = require("Data.Identity");
var Control_Monad_Writer_Trans = require("Control.Monad.Writer.Trans");
var Data_Tuple = require("Data.Tuple");
var Data_Monoid = require("Data.Monoid");
var runWriter = Prelude["<<<"](Prelude.semigroupoidArr)(Data_Identity.runIdentity)(Control_Monad_Writer_Trans.runWriterT);
var mapWriter = function (f) {
    return Control_Monad_Writer_Trans.mapWriterT(Prelude["<<<"](Prelude.semigroupoidArr)(Data_Identity.Identity)(Prelude["<<<"](Prelude.semigroupoidArr)(f)(Data_Identity.runIdentity)));
};
var execWriter = function (m) {
    return Data_Tuple.snd(runWriter(m));
};
module.exports = {
    mapWriter: mapWriter, 
    execWriter: execWriter, 
    runWriter: runWriter
};

},{"Control.Monad.Writer.Trans":54,"Data.Identity":85,"Data.Monoid":96,"Data.Tuple":108,"Prelude":130}],56:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var when = function (__dict_Monad_0) {
    return function (_108) {
        return function (m) {
            if (_108) {
                return m;
            };
            if (!_108) {
                return Prelude["return"](__dict_Monad_0)(Prelude.unit);
            };
            throw new Error("Failed pattern match");
        };
    };
};
var unless = function (__dict_Monad_1) {
    return function (_109) {
        return function (m) {
            if (!_109) {
                return m;
            };
            if (_109) {
                return Prelude["return"](__dict_Monad_1)(Prelude.unit);
            };
            throw new Error("Failed pattern match");
        };
    };
};
var replicateM = function (__dict_Monad_2) {
    return function (_106) {
        return function (m) {
            if (_106 === 0) {
                return Prelude["return"](__dict_Monad_2)([  ]);
            };
            return Prelude[">>="](__dict_Monad_2["__superclass_Prelude.Bind_1"]())(m)(function (_5) {
                return Prelude[">>="](__dict_Monad_2["__superclass_Prelude.Bind_1"]())(replicateM(__dict_Monad_2)(_106 - 1)(m))(function (_4) {
                    return Prelude["return"](__dict_Monad_2)(Prelude[":"](_5)(_4));
                });
            });
        };
    };
};
var foldM = function (__dict_Monad_3) {
    return function (f) {
        return function (a) {
            return function (_107) {
                if (_107.length === 0) {
                    return Prelude["return"](__dict_Monad_3)(a);
                };
                if (_107.length >= 1) {
                    var _875 = _107.slice(1);
                    return Prelude[">>="](__dict_Monad_3["__superclass_Prelude.Bind_1"]())(f(a)(_107[0]))(function (a$prime) {
                        return foldM(__dict_Monad_3)(f)(a$prime)(_875);
                    });
                };
                throw new Error("Failed pattern match");
            };
        };
    };
};
var filterM = function (__dict_Monad_4) {
    return function (p) {
        return function (_110) {
            if (_110.length === 0) {
                return Prelude["return"](__dict_Monad_4)([  ]);
            };
            if (_110.length >= 1) {
                var _882 = _110.slice(1);
                return Prelude[">>="](__dict_Monad_4["__superclass_Prelude.Bind_1"]())(p(_110[0]))(function (_7) {
                    return Prelude[">>="](__dict_Monad_4["__superclass_Prelude.Bind_1"]())(filterM(__dict_Monad_4)(p)(_882))(function (_6) {
                        return Prelude["return"](__dict_Monad_4)((function () {
                            if (_7) {
                                return Prelude[":"](_110[0])(_6);
                            };
                            if (!_7) {
                                return _6;
                            };
                            throw new Error("Failed pattern match");
                        })());
                    });
                });
            };
            throw new Error("Failed pattern match");
        };
    };
};
module.exports = {
    filterM: filterM, 
    unless: unless, 
    when: when, 
    foldM: foldM, 
    replicateM: replicateM
};

},{"Prelude":130}],57:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var MonadPlus = function (__superclass_Control$dotAlternative$dotAlternative_1, __superclass_Prelude$dotMonad_0) {
    this["__superclass_Control.Alternative.Alternative_1"] = __superclass_Control$dotAlternative$dotAlternative_1;
    this["__superclass_Prelude.Monad_0"] = __superclass_Prelude$dotMonad_0;
};
var guard = function (__dict_MonadPlus_0) {
    return function (_121) {
        if (_121) {
            return Prelude["return"](__dict_MonadPlus_0["__superclass_Prelude.Monad_0"]())(Prelude.unit);
        };
        if (!_121) {
            return Control_Plus.empty((__dict_MonadPlus_0["__superclass_Control.Alternative.Alternative_1"]())["__superclass_Control.Plus.Plus_1"]());
        };
        throw new Error("Failed pattern match");
    };
};
module.exports = {
    MonadPlus: MonadPlus, 
    guard: guard
};

},{"Control.Alternative":27,"Control.Plus":58,"Prelude":130}],58:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Alt = require("Control.Alt");
var Plus = function (__superclass_Control$dotAlt$dotAlt_0, empty) {
    this["__superclass_Control.Alt.Alt_0"] = __superclass_Control$dotAlt$dotAlt_0;
    this.empty = empty;
};
var empty = function (dict) {
    return dict.empty;
};
module.exports = {
    Plus: Plus, 
    empty: empty
};

},{"Control.Alt":26,"Prelude":130}],59:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
module.exports = {};

},{"Prelude":130}],60:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Function = require("Data.Function");
var Prelude = require("Prelude");
var Data_Maybe = require("Data.Maybe");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Control_Monad_ST = require("Control.Monad.ST");

  function runSTArray(f) {
    return f;
  };

  function emptySTArray() {
    return [];
  };

  function peekSTArrayImpl(just, nothing, arr, i) {
    return function() {
      var index = i >>> 0;
      return index < arr.length? just(arr[index]) : nothing;
    };
  };

  function pokeSTArrayImpl(arr, i, a) {
    return function() {
      var index = i >>> 0;
      var ret = index < arr.length;
      if (ret)
        arr[index] = a;
      return ret;
    };
  };

  function pushAllSTArrayImpl(arr, as) {
    return function(){
      return arr.push.apply(arr, as);
    };
  };

  function spliceSTArrayImpl(arr, index, howMany, bs) {
    return function(){
      return arr.splice.apply(arr, [index, howMany].concat(bs));
    };
  };

  function copyImpl(arr) {
    return function(){
      return arr.slice();
    };
  };

  function toAssocArray(arr) {
    return function(){
      var n = arr.length;
      var as = new Array(n);
      for (var i = 0; i < n; i++)
        as[i] = {value: arr[i], index: i};
      return as;
    };
  };
var thaw = copyImpl;
var spliceSTArray = Data_Function.runFn4(spliceSTArrayImpl);
var pushAllSTArray = Data_Function.runFn2(pushAllSTArrayImpl);
var pushSTArray = function (arr) {
    return function (a) {
        return pushAllSTArray(arr)([ a ]);
    };
};
var pokeSTArray = Data_Function.runFn3(pokeSTArrayImpl);
var peekSTArray = Data_Function.runFn4(peekSTArrayImpl)(Data_Maybe.Just.create)(Data_Maybe.Nothing.value);
var freeze = copyImpl;
module.exports = {
    toAssocArray: toAssocArray, 
    thaw: thaw, 
    freeze: freeze, 
    spliceSTArray: spliceSTArray, 
    pushAllSTArray: pushAllSTArray, 
    pushSTArray: pushSTArray, 
    pokeSTArray: pokeSTArray, 
    peekSTArray: peekSTArray, 
    emptySTArray: emptySTArray, 
    runSTArray: runSTArray
};

},{"Control.Monad.Eff":40,"Control.Monad.ST":50,"Data.Function":83,"Data.Maybe":89,"Prelude":130}],61:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Maybe = require("Data.Maybe");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var Control_MonadPlus = require("Control.MonadPlus");
var Prelude_Unsafe = require("Prelude.Unsafe");
function snoc(l) {  return function (e) {    var l1 = l.slice();    l1.push(e);     return l1;  };};
function length (xs) {  return xs.length;};
function findIndex (f) {  return function (arr) {    for (var i = 0, l = arr.length; i < l; i++) {      if (f(arr[i])) {        return i;      }    }    return -1;  };};
function findLastIndex (f) {  return function (arr) {    for (var i = arr.length - 1; i >= 0; i--) {      if (f(arr[i])) {        return i;      }    }    return -1;  };};
function append (l1) {  return function (l2) {    return l1.concat(l2);  };};
function concat (xss) {  var result = [];  for (var i = 0, l = xss.length; i < l; i++) {    result.push.apply(result, xss[i]);  }  return result;};
function reverse (l) {  return l.slice().reverse();};
function drop (n) {  return function (l) {    return l.slice(n);  };};
function slice (s) {  return function (e) {    return function (l) {      return l.slice(s, e);    };  };};
function insertAt (index) {  return function (a) {    return function (l) {      var l1 = l.slice();      l1.splice(index, 0, a);      return l1;    };   };};
function deleteAt (index) {  return function (n) {    return function (l) {      var l1 = l.slice();      l1.splice(index, n);      return l1;    };   };};
function updateAt (index) {  return function (a) {    return function (l) {      var i = ~~index;      if (i < 0 || i >= l.length) return l;      var l1 = l.slice();      l1[i] = a;      return l1;    };   };};
function concatMap (f) {  return function (arr) {    var result = [];    for (var i = 0, l = arr.length; i < l; i++) {      Array.prototype.push.apply(result, f(arr[i]));    }    return result;  };};
function map (f) {  return function (arr) {    var l = arr.length;    var result = new Array(l);    for (var i = 0; i < l; i++) {      result[i] = f(arr[i]);    }    return result;  };};
function filter (f) {  return function (arr) {    var n = 0;    var result = [];    for (var i = 0, l = arr.length; i < l; i++) {      if (f(arr[i])) {        result[n++] = arr[i];      }    }    return result;  };};
function range (start) {  return function (end) {    var i = ~~start, e = ~~end;    var step = i > e ? -1 : 1;    var result = [i], n = 1;    while (i !== e) {      i += step;      result[n++] = i;    }    return result;  };};
function zipWith (f) {  return function (xs) {    return function (ys) {      var l = xs.length < ys.length ? xs.length : ys.length;      var result = new Array(l);      for (var i = 0; i < l; i++) {        result[i] = f(xs[i])(ys[i]);      }      return result;    };  };};
function sortJS (f) {  return function (l) {    return l.slice().sort(function (x, y) {      return f(x)(y);    });  };};

function replicate(nn) {
  return function(v) {
    var n = nn > 0? nn : 0;
    var r = new Array(n);
    for (var i = 0; i < n; i++)
      r[i] = v;
    return r;
   };
}
;
var $dot$dot = range;
var $bang$bang = function (xs) {
    return function (n) {
        var isInt = function (n_1) {
            return n_1 !== ~~n_1;
        };
        var _973 = n < 0 || (n >= length(xs) || isInt(n));
        if (_973) {
            return Data_Maybe.Nothing.value;
        };
        if (!_973) {
            return new Data_Maybe.Just(xs[n]);
        };
        throw new Error("Failed pattern match");
    };
};
var take = function (n) {
    return slice(0)(n);
};
var tail = function (_150) {
    if (_150.length >= 1) {
        var _976 = _150.slice(1);
        return new Data_Maybe.Just(_976);
    };
    return Data_Maybe.Nothing.value;
};
var span = (function () {
    var go = function (__copy_acc) {
        return function (__copy_p) {
            return function (__copy__160) {
                var acc = __copy_acc;
                var p = __copy_p;
                var _160 = __copy__160;
                tco: while (true) {
                    if (_160.length >= 1) {
                        var _981 = _160.slice(1);
                        if (p(_160[0])) {
                            var __tco_acc = Prelude[":"](_160[0])(acc);
                            var __tco_p = p;
                            acc = __tco_acc;
                            p = __tco_p;
                            _160 = _981;
                            continue tco;
                        };
                    };
                    return {
                        init: reverse(acc), 
                        rest: _160
                    };
                };
            };
        };
    };
    return go([  ]);
})();
var takeWhile = function (p) {
    return function (xs) {
        return (span(p)(xs)).init;
    };
};
var sortBy = function (comp) {
    return function (xs) {
        var comp$prime = function (x) {
            return function (y) {
                var _982 = comp(x)(y);
                if (_982 instanceof Prelude.GT) {
                    return 1;
                };
                if (_982 instanceof Prelude.EQ) {
                    return 0;
                };
                if (_982 instanceof Prelude.LT) {
                    return -1;
                };
                throw new Error("Failed pattern match");
            };
        };
        return sortJS(comp$prime)(xs);
    };
};
var sort = function (__dict_Ord_0) {
    return function (xs) {
        return sortBy(Prelude.compare(__dict_Ord_0))(xs);
    };
};
var singleton = function (a) {
    return [ a ];
};
var semigroupArray = new Prelude.Semigroup(append);
var $$null = function (_152) {
    if (_152.length === 0) {
        return true;
    };
    return false;
};
var nubBy = function ($eq$eq) {
    return function (_156) {
        if (_156.length === 0) {
            return [  ];
        };
        if (_156.length >= 1) {
            var _987 = _156.slice(1);
            return Prelude[":"](_156[0])(nubBy($eq$eq)(filter(function (y) {
                return !$eq$eq(_156[0])(y);
            })(_987)));
        };
        throw new Error("Failed pattern match");
    };
};
var nub = function (__dict_Eq_1) {
    return nubBy(Prelude["=="](__dict_Eq_1));
};
var modifyAt = function (i) {
    return function (f) {
        return function (xs) {
            var _988 = $bang$bang(xs)(i);
            if (_988 instanceof Data_Maybe.Just) {
                return updateAt(i)(f(_988.value0))(xs);
            };
            if (_988 instanceof Data_Maybe.Nothing) {
                return xs;
            };
            throw new Error("Failed pattern match");
        };
    };
};
var mapMaybe = function (f) {
    return concatMap(Prelude["<<<"](Prelude.semigroupoidArr)(Data_Maybe.maybe([  ])(singleton))(f));
};
var last = function (xs) {
    return $bang$bang(xs)(length(xs) - 1);
};
var intersectBy = function (eq) {
    return function (_154) {
        return function (_155) {
            if (_154.length === 0) {
                return [  ];
            };
            if (_155.length === 0) {
                return [  ];
            };
            var el = function (x) {
                return findIndex(eq(x))(_155) >= 0;
            };
            return filter(el)(_154);
        };
    };
};
var intersect = function (__dict_Eq_2) {
    return intersectBy(Prelude["=="](__dict_Eq_2));
};
var init = function (_151) {
    if (_151.length === 0) {
        return Data_Maybe.Nothing.value;
    };
    return new Data_Maybe.Just(slice(0)(length(_151) - 1)(_151));
};
var head = function (xs) {
    return $bang$bang(xs)(0);
};
var groupBy = (function () {
    var go = function (__copy_acc) {
        return function (__copy_op) {
            return function (__copy__159) {
                var acc = __copy_acc;
                var op = __copy_op;
                var _159 = __copy__159;
                tco: while (true) {
                    if (_159.length === 0) {
                        return reverse(acc);
                    };
                    if (_159.length >= 1) {
                        var _998 = _159.slice(1);
                        var sp = span(op(_159[0]))(_998);
                        var __tco_acc = Prelude[":"](Prelude[":"](_159[0])(sp.init))(acc);
                        var __tco_op = op;
                        acc = __tco_acc;
                        op = __tco_op;
                        _159 = sp.rest;
                        continue tco;
                    };
                    throw new Error("Failed pattern match");
                };
            };
        };
    };
    return go([  ]);
})();
var group = function (__dict_Eq_3) {
    return function (xs) {
        return groupBy(Prelude["=="](__dict_Eq_3))(xs);
    };
};
var group$prime = function (__dict_Ord_4) {
    return Prelude["<<<"](Prelude.semigroupoidArr)(group(__dict_Ord_4["__superclass_Prelude.Eq_0"]()))(sort(__dict_Ord_4));
};
var functorArray = new Prelude.Functor(map);
var elemLastIndex = function (__dict_Eq_5) {
    return function (x) {
        return findLastIndex(Prelude["=="](__dict_Eq_5)(x));
    };
};
var elemIndex = function (__dict_Eq_6) {
    return function (x) {
        return findIndex(Prelude["=="](__dict_Eq_6)(x));
    };
};
var dropWhile = function (p) {
    return function (xs) {
        return (span(p)(xs)).rest;
    };
};
var deleteBy = function (eq) {
    return function (x) {
        return function (_153) {
            if (_153.length === 0) {
                return [  ];
            };
            var _1002 = findIndex(eq(x))(_153);
            if (_1002 < 0) {
                return _153;
            };
            return deleteAt(_1002)(1)(_153);
        };
    };
};
var $$delete = function (__dict_Eq_7) {
    return deleteBy(Prelude["=="](__dict_Eq_7));
};
var $bslash$bslash = function (__dict_Eq_8) {
    return function (xs) {
        return function (ys) {
            var go = function (__copy__157) {
                return function (__copy__158) {
                    var _157 = __copy__157;
                    var _158 = __copy__158;
                    tco: while (true) {
                        if (_158.length === 0) {
                            return _157;
                        };
                        if (_157.length === 0) {
                            return [  ];
                        };
                        if (_158.length >= 1) {
                            var _1006 = _158.slice(1);
                            var __tco__157 = $$delete(__dict_Eq_8)(_158[0])(_157);
                            _157 = __tco__157;
                            _158 = _1006;
                            continue tco;
                        };
                        throw new Error("Failed pattern match");
                    };
                };
            };
            return go(xs)(ys);
        };
    };
};
var catMaybes = concatMap(Data_Maybe.maybe([  ])(singleton));
var monadArray = new Prelude.Monad(function () {
    return applicativeArray;
}, function () {
    return bindArray;
});
var bindArray = new Prelude.Bind(Prelude.flip(concatMap), function () {
    return applyArray;
});
var applyArray = new Prelude.Apply(Prelude.ap(monadArray), function () {
    return functorArray;
});
var applicativeArray = new Prelude.Applicative(function () {
    return applyArray;
}, singleton);
var altArray = new Control_Alt.Alt(append, function () {
    return functorArray;
});
var plusArray = new Control_Plus.Plus(function () {
    return altArray;
}, [  ]);
var alternativeArray = new Control_Alternative.Alternative(function () {
    return plusArray;
}, function () {
    return applicativeArray;
});
var monadPlusArray = new Control_MonadPlus.MonadPlus(function () {
    return alternativeArray;
}, function () {
    return monadArray;
});
module.exports = {
    replicate: replicate, 
    takeWhile: takeWhile, 
    dropWhile: dropWhile, 
    span: span, 
    groupBy: groupBy, 
    "group'": group$prime, 
    group: group, 
    sortBy: sortBy, 
    sort: sort, 
    nubBy: nubBy, 
    nub: nub, 
    zipWith: zipWith, 
    range: range, 
    filter: filter, 
    concatMap: concatMap, 
    intersect: intersect, 
    intersectBy: intersectBy, 
    "\\\\": $bslash$bslash, 
    "delete": $$delete, 
    deleteBy: deleteBy, 
    modifyAt: modifyAt, 
    updateAt: updateAt, 
    deleteAt: deleteAt, 
    insertAt: insertAt, 
    take: take, 
    drop: drop, 
    reverse: reverse, 
    concat: concat, 
    append: append, 
    elemLastIndex: elemLastIndex, 
    elemIndex: elemIndex, 
    findLastIndex: findLastIndex, 
    findIndex: findIndex, 
    length: length, 
    catMaybes: catMaybes, 
    mapMaybe: mapMaybe, 
    map: map, 
    "null": $$null, 
    init: init, 
    tail: tail, 
    last: last, 
    head: head, 
    singleton: singleton, 
    snoc: snoc, 
    "..": $dot$dot, 
    "!!": $bang$bang, 
    functorArray: functorArray, 
    applyArray: applyArray, 
    applicativeArray: applicativeArray, 
    bindArray: bindArray, 
    monadArray: monadArray, 
    semigroupArray: semigroupArray, 
    altArray: altArray, 
    plusArray: plusArray, 
    alternativeArray: alternativeArray, 
    monadPlusArray: monadPlusArray
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.MonadPlus":57,"Control.Plus":58,"Data.Maybe":89,"Prelude":130,"Prelude.Unsafe":129}],62:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Const = require("Data.Const");
var Data_Either = require("Data.Either");
var Data_Tuple = require("Data.Tuple");
var Bifunctor = function (bimap) {
    this.bimap = bimap;
};
var bimap = function (dict) {
    return dict.bimap;
};
var lmap = function (__dict_Bifunctor_0) {
    return function (f) {
        return bimap(__dict_Bifunctor_0)(f)(Prelude.id(Prelude.categoryArr));
    };
};
var rmap = function (__dict_Bifunctor_1) {
    return bimap(__dict_Bifunctor_1)(Prelude.id(Prelude.categoryArr));
};
var bifunctorTuple = new Bifunctor(function (f) {
    return function (g) {
        return function (_458) {
            return new Data_Tuple.Tuple(f(_458.value0), g(_458.value1));
        };
    };
});
var bifunctorEither = new Bifunctor(function (f) {
    return function (g) {
        return function (_457) {
            if (_457 instanceof Data_Either.Left) {
                return new Data_Either.Left(f(_457.value0));
            };
            if (_457 instanceof Data_Either.Right) {
                return new Data_Either.Right(g(_457.value0));
            };
            throw new Error("Failed pattern match");
        };
    };
});
var bifunctorConst = new Bifunctor(function (f) {
    return function (_459) {
        return function (_460) {
            return f(_460);
        };
    };
});
module.exports = {
    Bifunctor: Bifunctor, 
    rmap: rmap, 
    lmap: lmap, 
    bimap: bimap, 
    bifunctorEither: bifunctorEither, 
    bifunctorTuple: bifunctorTuple, 
    bifunctorConst: bifunctorConst
};

},{"Data.Const":65,"Data.Either":74,"Data.Tuple":108,"Prelude":130}],63:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Maybe = require("Data.Maybe");
var PositivityRating = function (x) {
    return x;
};
var positivityRating = function (_6) {
    if (_6 === 1) {
        return new Data_Maybe.Just(1);
    };
    if (_6 === 2) {
        return new Data_Maybe.Just(2);
    };
    if (_6 === 3) {
        return new Data_Maybe.Just(3);
    };
    if (_6 === 4) {
        return new Data_Maybe.Just(4);
    };
    if (_6 === 5) {
        return new Data_Maybe.Just(5);
    };
    return Data_Maybe.Nothing.value;
};
var exampleCallNote = {
    id: new Data_Maybe.Just("5abe751c73019c38d911f09af10003ba"), 
    createdAt: new Data_Maybe.Just(1437321987167), 
    customer: "Chevron", 
    notes: "Looks like they will place an order at the next call.", 
    positivity: new Data_Maybe.Just(4)
};
var exampleCallNotes = [ exampleCallNote, exampleCallNote, exampleCallNote, exampleCallNote ];
var blankCallNote = {
    id: Data_Maybe.Nothing.value, 
    createdAt: Data_Maybe.Nothing.value, 
    customer: "", 
    notes: "", 
    positivity: Data_Maybe.Nothing.value
};
module.exports = {
    PositivityRating: PositivityRating, 
    positivityRating: positivityRating, 
    blankCallNote: blankCallNote, 
    exampleCallNotes: exampleCallNotes, 
    exampleCallNote: exampleCallNote
};

},{"Data.Maybe":89,"Prelude":130}],64:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");

    function toCharCode(c) {
      return c.charCodeAt(0);
    }
    ;

    function fromCharCode(c) {
      return String.fromCharCode(c);
    }
    ;
var Char = function (x) {
    return x;
};
var showChar = new Prelude.Show(function (_103) {
    return "Char " + Prelude.show(Prelude.showString)(_103);
});
var eqChar = new Prelude.Eq(function (a) {
    return function (b) {
        return !Prelude["=="](eqChar)(a)(b);
    };
}, function (_99) {
    return function (_100) {
        return _99 === _100;
    };
});
var ordChar = new Prelude.Ord(function () {
    return eqChar;
}, function (_101) {
    return function (_102) {
        return Prelude.compare(Prelude.ordString)(_101)(_102);
    };
});
var charString = function (_98) {
    return _98;
};
module.exports = {
    toCharCode: toCharCode, 
    fromCharCode: fromCharCode, 
    charString: charString, 
    eqChar: eqChar, 
    ordChar: ordChar, 
    showChar: showChar
};

},{"Prelude":130}],65:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Monoid = require("Data.Monoid");
var Data_Functor_Contravariant = require("Data.Functor.Contravariant");
var Data_Foldable = require("Data.Foldable");
var Data_Traversable = require("Data.Traversable");
var Const = function (x) {
    return x;
};
var showConst = function (__dict_Show_2) {
    return new Prelude.Show(function (_422) {
        return "Const (" + (Prelude.show(__dict_Show_2)(_422) + ")");
    });
};
var semigroupoidConst = new Prelude.Semigroupoid(function (_423) {
    return function (_424) {
        return _424;
    };
});
var semigroupConst = function (__dict_Semigroup_3) {
    return new Prelude.Semigroup(function (_425) {
        return function (_426) {
            return Prelude["<>"](__dict_Semigroup_3)(_425)(_426);
        };
    });
};
var monoidConst = function (__dict_Monoid_5) {
    return new Data_Monoid.Monoid(function () {
        return semigroupConst(__dict_Monoid_5["__superclass_Prelude.Semigroup_0"]());
    }, Data_Monoid.mempty(__dict_Monoid_5));
};
var getConst = function (_417) {
    return _417;
};
var functorConst = new Prelude.Functor(function (_427) {
    return function (_428) {
        return _428;
    };
});
var foldableConst = new Data_Foldable.Foldable(function (__dict_Monoid_6) {
    return function (_440) {
        return function (_441) {
            return Data_Monoid.mempty(__dict_Monoid_6);
        };
    };
}, function (_438) {
    return function (z) {
        return function (_439) {
            return z;
        };
    };
}, function (_436) {
    return function (z) {
        return function (_437) {
            return z;
        };
    };
});
var traversableConst = new Data_Traversable.Traversable(function () {
    return foldableConst;
}, function () {
    return functorConst;
}, function (__dict_Applicative_1) {
    return function (_444) {
        return Prelude.pure(__dict_Applicative_1)(_444);
    };
}, function (__dict_Applicative_0) {
    return function (_442) {
        return function (_443) {
            return Prelude.pure(__dict_Applicative_0)(_443);
        };
    };
});
var eqConst = function (__dict_Eq_7) {
    return new Prelude.Eq(function (c) {
        return function (c$prime) {
            return !Prelude["=="](eqConst(__dict_Eq_7))(c)(c$prime);
        };
    }, function (_418) {
        return function (_419) {
            return Prelude["=="](__dict_Eq_7)(_418)(_419);
        };
    });
};
var ordConst = function (__dict_Ord_4) {
    return new Prelude.Ord(function () {
        return eqConst(__dict_Ord_4["__superclass_Prelude.Eq_0"]());
    }, function (_420) {
        return function (_421) {
            return Prelude.compare(__dict_Ord_4)(_420)(_421);
        };
    });
};
var contravariantConst = new Data_Functor_Contravariant.Contravariant(function (_434) {
    return function (_435) {
        return _435;
    };
});
var applyConst = function (__dict_Semigroup_9) {
    return new Prelude.Apply(function (_429) {
        return function (_430) {
            return Prelude["<>"](__dict_Semigroup_9)(_429)(_430);
        };
    }, function () {
        return functorConst;
    });
};
var bindConst = function (__dict_Semigroup_8) {
    return new Prelude.Bind(function (_431) {
        return function (_432) {
            return _431;
        };
    }, function () {
        return applyConst(__dict_Semigroup_8);
    });
};
var applicativeConst = function (__dict_Monoid_10) {
    return new Prelude.Applicative(function () {
        return applyConst(__dict_Monoid_10["__superclass_Prelude.Semigroup_0"]());
    }, function (_433) {
        return Data_Monoid.mempty(__dict_Monoid_10);
    });
};
module.exports = {
    Const: Const, 
    getConst: getConst, 
    eqConst: eqConst, 
    ordConst: ordConst, 
    showConst: showConst, 
    semigroupoidConst: semigroupoidConst, 
    semigroupConst: semigroupConst, 
    monoidConst: monoidConst, 
    functorConst: functorConst, 
    applyConst: applyConst, 
    bindConst: bindConst, 
    applicativeConst: applicativeConst, 
    contravariantConst: contravariantConst, 
    foldableConst: foldableConst, 
    traversableConst: traversableConst
};

},{"Data.Foldable":76,"Data.Functor.Contravariant":84,"Data.Monoid":96,"Data.Traversable":107,"Prelude":130}],66:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_DOM_Simple_Unsafe_Element = require("Data.DOM.Simple.Unsafe.Element");
var Data_DOM_Simple_Unsafe_Utils = require("Data.DOM.Simple.Unsafe.Utils");
var Data_DOM_Simple_Unsafe_Document = require("Data.DOM.Simple.Unsafe.Document");
var DOM = require("DOM");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");
var Data_DOM_Simple_Element = require("Data.DOM.Simple.Element");
var Document = function (body, setBody, setTitle, title) {
    this.body = body;
    this.setBody = setBody;
    this.setTitle = setTitle;
    this.title = title;
};
var title = function (dict) {
    return dict.title;
};
var showHtmlDocument = new Prelude.Show(Data_DOM_Simple_Unsafe_Utils.showImpl);
var setTitle = function (dict) {
    return dict.setTitle;
};
var setBody = function (dict) {
    return dict.setBody;
};
var htmlDocumentElement = new Data_DOM_Simple_Element.Element(Data_DOM_Simple_Unsafe_Element.unsafeAppendChild, Data_DOM_Simple_Unsafe_Element.unsafeChildren, Data_DOM_Simple_Unsafe_Element.unsafeClassAdd, Data_DOM_Simple_Unsafe_Element.unsafeClassContains, Data_DOM_Simple_Unsafe_Element.unsafeClassRemove, Data_DOM_Simple_Unsafe_Element.unsafeClassToggle, Data_DOM_Simple_Unsafe_Element.unsafeContentWindow, Data_DOM_Simple_Unsafe_Element.unsafeGetAttribute, function (id) {
    return function (el) {
        return Prelude[">>="](Control_Monad_Eff.bindEff)(Data_DOM_Simple_Unsafe_Element.unsafeGetElementById(id)(el))(Prelude["<<<"](Prelude.semigroupoidArr)(Prelude["return"](Control_Monad_Eff.monadEff))(Data_DOM_Simple_Unsafe_Utils.ensure));
    };
}, Data_DOM_Simple_Unsafe_Element.unsafeGetElementsByClassName, Data_DOM_Simple_Unsafe_Element.unsafeGetElementsByName, Data_DOM_Simple_Unsafe_Element.unsafeGetStyleAttr, Data_DOM_Simple_Unsafe_Element.unsafeHasAttribute, Data_DOM_Simple_Unsafe_Element.unsafeInnerHTML, function (sel) {
    return function (el) {
        return Prelude[">>="](Control_Monad_Eff.bindEff)(Data_DOM_Simple_Unsafe_Element.unsafeQuerySelector(sel)(el))(Prelude["<<<"](Prelude.semigroupoidArr)(Prelude["return"](Control_Monad_Eff.monadEff))(Data_DOM_Simple_Unsafe_Utils.ensure));
    };
}, Data_DOM_Simple_Unsafe_Element.unsafeQuerySelectorAll, Data_DOM_Simple_Unsafe_Element.unsafeRemoveAttribute, Data_DOM_Simple_Unsafe_Element.unsafeSetAttribute, Data_DOM_Simple_Unsafe_Element.unsafeSetInnerHTML, Data_DOM_Simple_Unsafe_Element.unsafeSetStyleAttr, Data_DOM_Simple_Unsafe_Element.unsafeSetTextContent, Data_DOM_Simple_Unsafe_Element.unsafeSetValue, Data_DOM_Simple_Unsafe_Element.unsafeTextContent, Data_DOM_Simple_Unsafe_Element.unsafeValue);
var htmlDocument = new Document(Data_DOM_Simple_Unsafe_Document.unsafeBody, Data_DOM_Simple_Unsafe_Document.unsafeSetBody, Data_DOM_Simple_Unsafe_Document.unsafeSetTitle, Data_DOM_Simple_Unsafe_Document.unsafeTitle);
var body = function (dict) {
    return dict.body;
};
module.exports = {
    Document: Document, 
    setBody: setBody, 
    body: body, 
    setTitle: setTitle, 
    title: title, 
    htmlDocumentElement: htmlDocumentElement, 
    htmlDocument: htmlDocument, 
    showHtmlDocument: showHtmlDocument
};

},{"Control.Monad.Eff":40,"DOM":59,"Data.DOM.Simple.Element":67,"Data.DOM.Simple.Types":68,"Data.DOM.Simple.Unsafe.Document":69,"Data.DOM.Simple.Unsafe.Element":70,"Data.DOM.Simple.Unsafe.Utils":71,"Prelude":130}],67:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_DOM_Simple_Unsafe_Element = require("Data.DOM.Simple.Unsafe.Element");
var Data_DOM_Simple_Unsafe_Utils = require("Data.DOM.Simple.Unsafe.Utils");
var Data_Foldable = require("Data.Foldable");
var Data_Tuple = require("Data.Tuple");
var Control_Monad_Eff = require("Control.Monad.Eff");
var DOM = require("DOM");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");
var Data_Maybe = require("Data.Maybe");
var Data_Array = require("Data.Array");
var Element = function (appendChild, children, classAdd, classContains, classRemove, classToggle, contentWindow, getAttribute, getElementById, getElementsByClassName, getElementsByName, getStyleAttr, hasAttribute, innerHTML, querySelector, querySelectorAll, removeAttribute, setAttribute, setInnerHTML, setStyleAttr, setTextContent, setValue, textContent, value) {
    this.appendChild = appendChild;
    this.children = children;
    this.classAdd = classAdd;
    this.classContains = classContains;
    this.classRemove = classRemove;
    this.classToggle = classToggle;
    this.contentWindow = contentWindow;
    this.getAttribute = getAttribute;
    this.getElementById = getElementById;
    this.getElementsByClassName = getElementsByClassName;
    this.getElementsByName = getElementsByName;
    this.getStyleAttr = getStyleAttr;
    this.hasAttribute = hasAttribute;
    this.innerHTML = innerHTML;
    this.querySelector = querySelector;
    this.querySelectorAll = querySelectorAll;
    this.removeAttribute = removeAttribute;
    this.setAttribute = setAttribute;
    this.setInnerHTML = setInnerHTML;
    this.setStyleAttr = setStyleAttr;
    this.setTextContent = setTextContent;
    this.setValue = setValue;
    this.textContent = textContent;
    this.value = value;
};
var value = function (dict) {
    return dict.value;
};
var textContent = function (dict) {
    return dict.textContent;
};
var showHtmlElement = new Prelude.Show(Data_DOM_Simple_Unsafe_Utils.showImpl);
var setValue = function (dict) {
    return dict.setValue;
};
var setTextContent = function (dict) {
    return dict.setTextContent;
};
var setStyleAttr = function (dict) {
    return dict.setStyleAttr;
};
var setStyleAttrs = function (__dict_Element_0) {
    return function (xs) {
        return function (el) {
            return Data_Foldable.for_(Control_Monad_Eff.applicativeEff)(Data_Foldable.foldableArray)(xs)(function (kv) {
                return setStyleAttr(__dict_Element_0)(Data_Tuple.fst(kv))(Data_Tuple.snd(kv))(el);
            });
        };
    };
};
var setInnerHTML = function (dict) {
    return dict.setInnerHTML;
};
var setAttribute = function (dict) {
    return dict.setAttribute;
};
var setAttributes = function (__dict_Element_1) {
    return function (xs) {
        return function (el) {
            return Data_Foldable.for_(Control_Monad_Eff.applicativeEff)(Data_Foldable.foldableArray)(xs)(function (kv) {
                return setAttribute(__dict_Element_1)(Data_Tuple.fst(kv))(Data_Tuple.snd(kv))(el);
            });
        };
    };
};
var removeAttribute = function (dict) {
    return dict.removeAttribute;
};
var querySelectorAll = function (dict) {
    return dict.querySelectorAll;
};
var querySelector = function (dict) {
    return dict.querySelector;
};
var innerHTML = function (dict) {
    return dict.innerHTML;
};
var htmlElement = new Element(Data_DOM_Simple_Unsafe_Element.unsafeAppendChild, Data_DOM_Simple_Unsafe_Element.unsafeChildren, Data_DOM_Simple_Unsafe_Element.unsafeClassAdd, Data_DOM_Simple_Unsafe_Element.unsafeClassContains, Data_DOM_Simple_Unsafe_Element.unsafeClassRemove, Data_DOM_Simple_Unsafe_Element.unsafeClassToggle, Data_DOM_Simple_Unsafe_Element.unsafeContentWindow, Data_DOM_Simple_Unsafe_Element.unsafeGetAttribute, function (id) {
    return function (el) {
        return Prelude[">>="](Control_Monad_Eff.bindEff)(Data_DOM_Simple_Unsafe_Element.unsafeGetElementById(id)(el))(Prelude[">>>"](Prelude.semigroupoidArr)(Data_DOM_Simple_Unsafe_Utils.ensure)(Prelude["return"](Control_Monad_Eff.monadEff)));
    };
}, Data_DOM_Simple_Unsafe_Element.unsafeGetElementsByClassName, Data_DOM_Simple_Unsafe_Element.unsafeGetElementsByName, Data_DOM_Simple_Unsafe_Element.unsafeGetStyleAttr, Data_DOM_Simple_Unsafe_Element.unsafeHasAttribute, Data_DOM_Simple_Unsafe_Element.unsafeInnerHTML, function (sel) {
    return function (el) {
        return Prelude[">>="](Control_Monad_Eff.bindEff)(Data_DOM_Simple_Unsafe_Element.unsafeQuerySelector(sel)(el))(Prelude[">>>"](Prelude.semigroupoidArr)(Data_DOM_Simple_Unsafe_Utils.ensure)(Prelude["return"](Control_Monad_Eff.monadEff)));
    };
}, Data_DOM_Simple_Unsafe_Element.unsafeQuerySelectorAll, Data_DOM_Simple_Unsafe_Element.unsafeRemoveAttribute, Data_DOM_Simple_Unsafe_Element.unsafeSetAttribute, Data_DOM_Simple_Unsafe_Element.unsafeSetInnerHTML, Data_DOM_Simple_Unsafe_Element.unsafeSetStyleAttr, Data_DOM_Simple_Unsafe_Element.unsafeSetTextContent, Data_DOM_Simple_Unsafe_Element.unsafeSetValue, Data_DOM_Simple_Unsafe_Element.unsafeTextContent, Data_DOM_Simple_Unsafe_Element.unsafeValue);
var hasAttribute = function (dict) {
    return dict.hasAttribute;
};
var getStyleAttr = function (dict) {
    return dict.getStyleAttr;
};
var getElementsByName = function (dict) {
    return dict.getElementsByName;
};
var getElementsByClassName = function (dict) {
    return dict.getElementsByClassName;
};
var getElementById = function (dict) {
    return dict.getElementById;
};
var getAttribute = function (dict) {
    return dict.getAttribute;
};
var focus = Data_DOM_Simple_Unsafe_Element.unsafeFocus;
var contentWindow = function (dict) {
    return dict.contentWindow;
};
var click = Data_DOM_Simple_Unsafe_Element.unsafeClick;
var classToggle = function (dict) {
    return dict.classToggle;
};
var classRemove = function (dict) {
    return dict.classRemove;
};
var classContains = function (dict) {
    return dict.classContains;
};
var classAdd = function (dict) {
    return dict.classAdd;
};
var children = function (dict) {
    return dict.children;
};
var blur = Data_DOM_Simple_Unsafe_Element.unsafeBlur;
var appendChild = function (dict) {
    return dict.appendChild;
};
module.exports = {
    Element: Element, 
    blur: blur, 
    focus: focus, 
    click: click, 
    setStyleAttrs: setStyleAttrs, 
    setAttributes: setAttributes, 
    classContains: classContains, 
    classToggle: classToggle, 
    classAdd: classAdd, 
    classRemove: classRemove, 
    contentWindow: contentWindow, 
    setValue: setValue, 
    value: value, 
    setTextContent: setTextContent, 
    textContent: textContent, 
    setInnerHTML: setInnerHTML, 
    innerHTML: innerHTML, 
    appendChild: appendChild, 
    children: children, 
    setStyleAttr: setStyleAttr, 
    getStyleAttr: getStyleAttr, 
    removeAttribute: removeAttribute, 
    hasAttribute: hasAttribute, 
    setAttribute: setAttribute, 
    getAttribute: getAttribute, 
    querySelectorAll: querySelectorAll, 
    querySelector: querySelector, 
    getElementsByName: getElementsByName, 
    getElementsByClassName: getElementsByClassName, 
    getElementById: getElementById, 
    htmlElement: htmlElement, 
    showHtmlElement: showHtmlElement
};

},{"Control.Monad.Eff":40,"DOM":59,"Data.Array":61,"Data.DOM.Simple.Types":68,"Data.DOM.Simple.Unsafe.Element":70,"Data.DOM.Simple.Unsafe.Utils":71,"Data.Foldable":76,"Data.Maybe":89,"Data.Tuple":108,"Prelude":130}],68:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Eff = require("Control.Monad.Eff");
module.exports = {};

},{"Control.Monad.Eff":40,"Prelude":130}],69:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var DOM = require("DOM");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");

  function unsafeTitle(src) {
    return function () {
      return src.title;
    };
  };

  function unsafeSetTitle(value) {
    return function (src) {
      return function () {
        src.title = value;
      };
    };
  };

  function unsafeBody(src) {
    return function () {
      return src.body;
    };
  };

  function unsafeSetBody(value) {
    return function (src) {
      return function () {
        src.body = value;
      };
    };
  };
module.exports = {
    unsafeSetBody: unsafeSetBody, 
    unsafeBody: unsafeBody, 
    unsafeSetTitle: unsafeSetTitle, 
    unsafeTitle: unsafeTitle
};

},{"Control.Monad.Eff":40,"DOM":59,"Data.DOM.Simple.Types":68,"Prelude":130}],70:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var DOM = require("DOM");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");

  function unsafeGetElementById(targ_id) {
    return function (src) {
      return function () {
        return src.getElementById(targ_id);
      };
    };
  };

  function unsafeGetElementsByClassName(targ_id) {
    return function (src) {
      return function () {
        return src.getElementsByClassName(targ_id);
      };
    };
  };

  function unsafeGetElementsByName(targ_id) {
    return function (src) {
      return function () {
        return src.getElementsByName(targ_id);
      };
    };
  };

  function unsafeQuerySelector(selector) {
    return function (src) {
      return function () {
        return src.querySelector(selector);
      };
    };
  };

  function unsafeQuerySelectorAll(selector) {
    return function (src) {
      return function () {
        return src.querySelectorAll(selector);
      };
    };
  };

  function unsafeGetAttribute(name) {
    return function (src) {
      return function () {
        return src.getAttribute(name);
      };
    };
  };

  function unsafeSetAttribute(name) {
    return function (value) {
      return function (src) {
        return function () {
          src.setAttribute(name, value);
          return {};
        };
      };
    };
  };

  function unsafeHasAttribute(name) {
    return function (src) {
      return function () {
        return src.hasAttribute(name);
      };
    };
  };

  function unsafeRemoveAttribute(name) {
    return function (src) {
      return function () {
        src.removeAttribute(name);
        return {};
      };
    };
  };

  function unsafeGetStyleAttr(name) {
    return function (src) {
      return function () {
        return src.style[name];
      };
    };
  };

  function unsafeSetStyleAttr(name) {
    return function (value) {
      return function (src) {
        return function () {
          src.style[name] = value;
          return {};
        };
      };
    };
  };

  function unsafeChildren(src) {
    return function () {
      return src.children;
    };
  };

  function unsafeAppendChild(src) {
    return function (child) {
      return function () {
        return src.appendChild(child);
      };
    };
  };

  function unsafeInnerHTML(src) {
    return function () {
      return src.innerHTML;
    };
  };

  function unsafeSetInnerHTML(value) {
    return function (src) {
      return function () {
        src.innerHTML = value;
        return {};
      };
    };
  };

  function unsafeTextContent(src) {
    return function () {
      return src.textContent;
    };
  };

  function unsafeSetTextContent(value) {
    return function (src) {
      return function () {
        src.textContent = value;
        return {};
      };
    };
  };

  function unsafeValue(src) {
    return function () {
      return src.value;
    };
  };

  function unsafeSetValue(value) {
    return function (src) {
      return function () {
        src.value = value;
        return {};
      };
    };
  };

  function unsafeContentWindow(obj) {
    return function () {
      return obj.contentWindow;
    };
  };

  function unsafeClassAdd(value) {
    return function (src) {
      return function () {
        src.classList.add(value);
        return {};
      };
    };
  };

  function unsafeClassRemove(value) {
    return function (src) {
      return function () {
        src.classList.remove(value);
        return {};
      };
    };
  };

  function unsafeClassToggle(value) {
    return function (src) {
      return function () {
        src.classList.toggle(value);
        return {};
      };
    };
  };

  function unsafeClassContains(value) {
    return function (src) {
      return function () {
        return src.classList.contains(value);
      };
    };
  };

  function unsafeClick(src) {
    return function () {
      src.click();
      return {};
    };
  };

  function unsafeFocus(src) {
    return function () {
      src.focus();
      return {};
    };
  };

  function unsafeBlur(src) {
    return function () {
      src.blur();
      return {};
    };
  };
module.exports = {
    unsafeBlur: unsafeBlur, 
    unsafeFocus: unsafeFocus, 
    unsafeClick: unsafeClick, 
    unsafeClassContains: unsafeClassContains, 
    unsafeClassToggle: unsafeClassToggle, 
    unsafeClassRemove: unsafeClassRemove, 
    unsafeClassAdd: unsafeClassAdd, 
    unsafeContentWindow: unsafeContentWindow, 
    unsafeSetValue: unsafeSetValue, 
    unsafeValue: unsafeValue, 
    unsafeSetTextContent: unsafeSetTextContent, 
    unsafeTextContent: unsafeTextContent, 
    unsafeSetInnerHTML: unsafeSetInnerHTML, 
    unsafeInnerHTML: unsafeInnerHTML, 
    unsafeAppendChild: unsafeAppendChild, 
    unsafeChildren: unsafeChildren, 
    unsafeSetStyleAttr: unsafeSetStyleAttr, 
    unsafeGetStyleAttr: unsafeGetStyleAttr, 
    unsafeRemoveAttribute: unsafeRemoveAttribute, 
    unsafeHasAttribute: unsafeHasAttribute, 
    unsafeSetAttribute: unsafeSetAttribute, 
    unsafeGetAttribute: unsafeGetAttribute, 
    unsafeQuerySelectorAll: unsafeQuerySelectorAll, 
    unsafeQuerySelector: unsafeQuerySelector, 
    unsafeGetElementsByName: unsafeGetElementsByName, 
    unsafeGetElementsByClassName: unsafeGetElementsByClassName, 
    unsafeGetElementById: unsafeGetElementById
};

},{"Control.Monad.Eff":40,"DOM":59,"Data.DOM.Simple.Types":68,"Prelude":130}],71:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Maybe = require("Data.Maybe");

  function ensure3(nothing) {
    return function(just) {
      return function(v) {
        if (v === undefined || v === null) {
          return nothing;
        } else {
          return just(v);
        }
      };
   };
  };

  function showImpl(v) {
    return function () {
      return v.toString();
    };
  };
var ensure = ensure3(Data_Maybe.Nothing.value)(Data_Maybe.Just.create);
module.exports = {
    showImpl: showImpl, 
    ensure: ensure, 
    ensure3: ensure3
};

},{"Data.Maybe":89,"Prelude":130}],72:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var DOM = require("DOM");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");

  function unsafeDocument(win) {
    return function () {
      return win.document;
    };
  };

  function unsafeNavigator(win) {
    return function () {
      return win.navigator;
    };
  };

  function unsafeLocation(win) {
    return function () {
      return win.location;
    };
  };

  function unsafeGetLocation(loc) {
    return function () {
      return loc;
    };
  };

  function unsafeSetLocation(value) {
    return function (loc) {
      return function () {
        location.assign(value);
      };
    };
  };

  function unsafeGetSearchLocation(loc) {
    return function () {
      return loc.search;
    };
  };

  function unsafeSetTimeout(win) {
    return function(delay) {
      return function(func) {
        return function() {
          return win.setTimeout(func, delay);
        };
      };
    };
  };

  function unsafeSetInterval(win) {
    return function(delay) {
      return function(func) {
        return function() {
          return win.setInterval(func, delay);
        };
      };
    };
  };

  function unsafeClearTimeout(win) {
    return function(timeout) {
      return function() {
        win.clearTimeout(timeout);
      };
    };
  };

  function unsafeInnerWidth(win) {
    return function() {
      return win.innerWidth;
    };
  };

  function unsafeInnerHeight(win) {
    return function() {
      return win.innerHeight;
    };
  };
module.exports = {
    unsafeInnerHeight: unsafeInnerHeight, 
    unsafeInnerWidth: unsafeInnerWidth, 
    unsafeClearTimeout: unsafeClearTimeout, 
    unsafeSetInterval: unsafeSetInterval, 
    unsafeSetTimeout: unsafeSetTimeout, 
    unsafeGetSearchLocation: unsafeGetSearchLocation, 
    unsafeSetLocation: unsafeSetLocation, 
    unsafeGetLocation: unsafeGetLocation, 
    unsafeLocation: unsafeLocation, 
    unsafeNavigator: unsafeNavigator, 
    unsafeDocument: unsafeDocument
};

},{"Control.Monad.Eff":40,"DOM":59,"Data.DOM.Simple.Types":68,"Prelude":130}],73:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_DOM_Simple_Unsafe_Window = require("Data.DOM.Simple.Unsafe.Window");
var Prelude = require("Prelude");
var Data_String = require("Data.String");
var Data_Array = require("Data.Array");
var DOM = require("DOM");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");
var Data_Maybe = require("Data.Maybe");
var globalWindow = window;;
var Location = function (getLocation, search, setLocation) {
    this.getLocation = getLocation;
    this.search = search;
    this.setLocation = setLocation;
};
var Window = function (clearTimeout, document, innerHeight, innerWidth, location, navigator, setInterval, setTimeout) {
    this.clearTimeout = clearTimeout;
    this.document = document;
    this.innerHeight = innerHeight;
    this.innerWidth = innerWidth;
    this.location = location;
    this.navigator = navigator;
    this.setInterval = setInterval;
    this.setTimeout = setTimeout;
};
var setTimeout = function (dict) {
    return dict.setTimeout;
};
var setLocation = function (dict) {
    return dict.setLocation;
};
var setInterval = function (dict) {
    return dict.setInterval;
};
var search = function (dict) {
    return dict.search;
};
var navigator = function (dict) {
    return dict.navigator;
};
var location = function (dict) {
    return dict.location;
};
var innerWidth = function (dict) {
    return dict.innerWidth;
};
var innerHeight = function (dict) {
    return dict.innerHeight;
};
var htmlWindow = new Window(Data_DOM_Simple_Unsafe_Window.unsafeClearTimeout, Data_DOM_Simple_Unsafe_Window.unsafeDocument, Data_DOM_Simple_Unsafe_Window.unsafeInnerHeight, Data_DOM_Simple_Unsafe_Window.unsafeInnerWidth, Data_DOM_Simple_Unsafe_Window.unsafeLocation, Data_DOM_Simple_Unsafe_Window.unsafeNavigator, Data_DOM_Simple_Unsafe_Window.unsafeSetInterval, Data_DOM_Simple_Unsafe_Window.unsafeSetTimeout);
var getLocationValue = function (input) {
    return function (key) {
        var kvParser = function (value) {
            if (value.length === 2 && value[0] === key) {
                return new Data_Maybe.Just(value[1]);
            };
            return Data_Maybe.Nothing.value;
        };
        var sanitizedInput = (function () {
            var _215 = Data_String.indexOf("?")(input) === 0;
            if (_215) {
                return Data_String.drop(1)(input);
            };
            if (!_215) {
                return input;
            };
            throw new Error("Failed pattern match");
        })();
        var kv = Data_Array.map(Data_String.split("="))(Data_String.split("&")(sanitizedInput));
        return Data_Array.head(Data_Array.mapMaybe(kvParser)(kv));
    };
};
var getLocation = function (dict) {
    return dict.getLocation;
};
var domLocation = new Location(Data_DOM_Simple_Unsafe_Window.unsafeGetLocation, Data_DOM_Simple_Unsafe_Window.unsafeGetSearchLocation, Data_DOM_Simple_Unsafe_Window.unsafeSetLocation);
var document = function (dict) {
    return dict.document;
};
var clearTimeout = function (dict) {
    return dict.clearTimeout;
};
module.exports = {
    Window: Window, 
    Location: Location, 
    getLocationValue: getLocationValue, 
    globalWindow: globalWindow, 
    innerHeight: innerHeight, 
    innerWidth: innerWidth, 
    clearTimeout: clearTimeout, 
    setInterval: setInterval, 
    setTimeout: setTimeout, 
    location: location, 
    navigator: navigator, 
    document: document, 
    search: search, 
    setLocation: setLocation, 
    getLocation: getLocation, 
    htmlWindow: htmlWindow, 
    domLocation: domLocation
};

},{"Control.Monad.Eff":40,"DOM":59,"Data.Array":61,"Data.DOM.Simple.Types":68,"Data.DOM.Simple.Unsafe.Window":72,"Data.Maybe":89,"Data.String":106,"Prelude":130}],74:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Alt = require("Control.Alt");
var Control_Extend = require("Control.Extend");
var Left = (function () {
    function Left(value0) {
        this.value0 = value0;
    };
    Left.create = function (value0) {
        return new Left(value0);
    };
    return Left;
})();
var Right = (function () {
    function Right(value0) {
        this.value0 = value0;
    };
    Right.create = function (value0) {
        return new Right(value0);
    };
    return Right;
})();
var showEither = function (__dict_Show_0) {
    return function (__dict_Show_1) {
        return new Prelude.Show(function (_129) {
            if (_129 instanceof Left) {
                return "Left (" + (Prelude.show(__dict_Show_0)(_129.value0) + ")");
            };
            if (_129 instanceof Right) {
                return "Right (" + (Prelude.show(__dict_Show_1)(_129.value0) + ")");
            };
            throw new Error("Failed pattern match");
        });
    };
};
var functorEither = new Prelude.Functor(function (f) {
    return function (_125) {
        if (_125 instanceof Left) {
            return new Left(_125.value0);
        };
        if (_125 instanceof Right) {
            return new Right(f(_125.value0));
        };
        throw new Error("Failed pattern match");
    };
});
var extendEither = new Control_Extend.Extend(function (f) {
    return function (_128) {
        if (_128 instanceof Left) {
            return new Left(_128.value0);
        };
        return new Right(f(_128));
    };
}, function () {
    return functorEither;
});
var eqEither = function (__dict_Eq_4) {
    return function (__dict_Eq_5) {
        return new Prelude.Eq(function (a) {
            return function (b) {
                return !Prelude["=="](eqEither(__dict_Eq_4)(__dict_Eq_5))(a)(b);
            };
        }, function (_130) {
            return function (_131) {
                if (_130 instanceof Left && _131 instanceof Left) {
                    return Prelude["=="](__dict_Eq_4)(_130.value0)(_131.value0);
                };
                if (_130 instanceof Right && _131 instanceof Right) {
                    return Prelude["=="](__dict_Eq_5)(_130.value0)(_131.value0);
                };
                return false;
            };
        });
    };
};
var ordEither = function (__dict_Ord_2) {
    return function (__dict_Ord_3) {
        return new Prelude.Ord(function () {
            return eqEither(__dict_Ord_2["__superclass_Prelude.Eq_0"]())(__dict_Ord_3["__superclass_Prelude.Eq_0"]());
        }, function (_132) {
            return function (_133) {
                if (_132 instanceof Left && _133 instanceof Left) {
                    return Prelude.compare(__dict_Ord_2)(_132.value0)(_133.value0);
                };
                if (_132 instanceof Right && _133 instanceof Right) {
                    return Prelude.compare(__dict_Ord_3)(_132.value0)(_133.value0);
                };
                if (_132 instanceof Left) {
                    return Prelude.LT.value;
                };
                if (_133 instanceof Left) {
                    return Prelude.GT.value;
                };
                throw new Error("Failed pattern match");
            };
        });
    };
};
var either = function (f) {
    return function (g) {
        return function (_124) {
            if (_124 instanceof Left) {
                return f(_124.value0);
            };
            if (_124 instanceof Right) {
                return g(_124.value0);
            };
            throw new Error("Failed pattern match");
        };
    };
};
var isLeft = either(Prelude["const"](true))(Prelude["const"](false));
var isRight = either(Prelude["const"](false))(Prelude["const"](true));
var applyEither = new Prelude.Apply(function (_126) {
    return function (r) {
        if (_126 instanceof Left) {
            return new Left(_126.value0);
        };
        if (_126 instanceof Right) {
            return Prelude["<$>"](functorEither)(_126.value0)(r);
        };
        throw new Error("Failed pattern match");
    };
}, function () {
    return functorEither;
});
var bindEither = new Prelude.Bind(either(function (e) {
    return function (_123) {
        return new Left(e);
    };
})(function (a) {
    return function (f) {
        return f(a);
    };
}), function () {
    return applyEither;
});
var applicativeEither = new Prelude.Applicative(function () {
    return applyEither;
}, Right.create);
var monadEither = new Prelude.Monad(function () {
    return applicativeEither;
}, function () {
    return bindEither;
});
var altEither = new Control_Alt.Alt(function (_127) {
    return function (r) {
        if (_127 instanceof Left) {
            return r;
        };
        return _127;
    };
}, function () {
    return functorEither;
});
module.exports = {
    Left: Left, 
    Right: Right, 
    isRight: isRight, 
    isLeft: isLeft, 
    either: either, 
    functorEither: functorEither, 
    applyEither: applyEither, 
    applicativeEither: applicativeEither, 
    altEither: altEither, 
    bindEither: bindEither, 
    monadEither: monadEither, 
    extendEither: extendEither, 
    showEither: showEither, 
    eqEither: eqEither, 
    ordEither: ordEither
};

},{"Control.Alt":26,"Control.Extend":31,"Prelude":130}],75:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
function mkExists(fa) {  return fa;};
function runExists(f) {  return function(fa) {    return f(fa);  };};
module.exports = {
    runExists: runExists, 
    mkExists: mkExists
};

},{"Prelude":130}],76:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Monoid = require("Data.Monoid");
var Control_Apply = require("Control.Apply");
var Data_Monoid_First = require("Data.Monoid.First");
var Data_Either = require("Data.Either");
var Data_Maybe = require("Data.Maybe");
var Data_Monoid_Additive = require("Data.Monoid.Additive");
var Data_Monoid_Dual = require("Data.Monoid.Dual");
var Data_Monoid_Last = require("Data.Monoid.Last");
var Data_Monoid_Multiplicative = require("Data.Monoid.Multiplicative");
var Data_Tuple = require("Data.Tuple");

  function foldrArray(f) {
    return function(z) {
      return function(xs) {
        var acc = z;
        for (var i = xs.length - 1; i >= 0; --i) {
          acc = f(xs[i])(acc);
        }
        return acc;
      };
    };
  }
  ;

  function foldlArray(f) {
    return function(z) {
      return function(xs) {
        var acc = z;
        for (var i = 0, len = xs.length; i < len; ++i) {
          acc = f(acc)(xs[i]);
        }
        return acc;
      };
    };
  }
  ;
var Foldable = function (foldMap, foldl, foldr) {
    this.foldMap = foldMap;
    this.foldl = foldl;
    this.foldr = foldr;
};
var foldr = function (dict) {
    return dict.foldr;
};
var traverse_ = function (__dict_Applicative_0) {
    return function (__dict_Foldable_1) {
        return function (f) {
            return foldr(__dict_Foldable_1)(Prelude["<<<"](Prelude.semigroupoidArr)(Control_Apply["*>"](__dict_Applicative_0["__superclass_Prelude.Apply_0"]()))(f))(Prelude.pure(__dict_Applicative_0)(Prelude.unit));
        };
    };
};
var for_ = function (__dict_Applicative_2) {
    return function (__dict_Foldable_3) {
        return Prelude.flip(traverse_(__dict_Applicative_2)(__dict_Foldable_3));
    };
};
var sequence_ = function (__dict_Applicative_4) {
    return function (__dict_Foldable_5) {
        return traverse_(__dict_Applicative_4)(__dict_Foldable_5)(Prelude.id(Prelude.categoryArr));
    };
};
var foldl = function (dict) {
    return dict.foldl;
};
var intercalate = function (__dict_Foldable_6) {
    return function (__dict_Monoid_7) {
        return function (sep) {
            return function (xs) {
                var go = function (_396) {
                    return function (x) {
                        if (_396.init) {
                            return {
                                init: false, 
                                acc: x
                            };
                        };
                        return {
                            init: false, 
                            acc: Prelude["<>"](__dict_Monoid_7["__superclass_Prelude.Semigroup_0"]())(_396.acc)(Prelude["<>"](__dict_Monoid_7["__superclass_Prelude.Semigroup_0"]())(sep)(x))
                        };
                    };
                };
                return (foldl(__dict_Foldable_6)(go)({
                    init: true, 
                    acc: Data_Monoid.mempty(__dict_Monoid_7)
                })(xs)).acc;
            };
        };
    };
};
var mconcat = function (__dict_Foldable_8) {
    return function (__dict_Monoid_9) {
        return foldl(__dict_Foldable_8)(Prelude["<>"](__dict_Monoid_9["__superclass_Prelude.Semigroup_0"]()))(Data_Monoid.mempty(__dict_Monoid_9));
    };
};
var or = function (__dict_Foldable_10) {
    return foldl(__dict_Foldable_10)(Prelude["||"](Prelude.boolLikeBoolean))(false);
};
var product = function (__dict_Foldable_11) {
    return foldl(__dict_Foldable_11)(Prelude["*"](Prelude.semiringNumber))(1);
};
var sum = function (__dict_Foldable_12) {
    return foldl(__dict_Foldable_12)(Prelude["+"](Prelude.semiringNumber))(0);
};
var foldableTuple = new Foldable(function (__dict_Monoid_13) {
    return function (f) {
        return function (_380) {
            return f(_380.value1);
        };
    };
}, function (f) {
    return function (z) {
        return function (_379) {
            return f(z)(_379.value1);
        };
    };
}, function (f) {
    return function (z) {
        return function (_378) {
            return f(_378.value1)(z);
        };
    };
});
var foldableMultiplicative = new Foldable(function (__dict_Monoid_14) {
    return function (f) {
        return function (_395) {
            return f(_395);
        };
    };
}, function (f) {
    return function (z) {
        return function (_394) {
            return f(z)(_394);
        };
    };
}, function (f) {
    return function (z) {
        return function (_393) {
            return f(_393)(z);
        };
    };
});
var foldableMaybe = new Foldable(function (__dict_Monoid_15) {
    return function (f) {
        return function (_377) {
            if (_377 instanceof Data_Maybe.Nothing) {
                return Data_Monoid.mempty(__dict_Monoid_15);
            };
            if (_377 instanceof Data_Maybe.Just) {
                return f(_377.value0);
            };
            throw new Error("Failed pattern match");
        };
    };
}, function (f) {
    return function (z) {
        return function (_376) {
            if (_376 instanceof Data_Maybe.Nothing) {
                return z;
            };
            if (_376 instanceof Data_Maybe.Just) {
                return f(z)(_376.value0);
            };
            throw new Error("Failed pattern match");
        };
    };
}, function (f) {
    return function (z) {
        return function (_375) {
            if (_375 instanceof Data_Maybe.Nothing) {
                return z;
            };
            if (_375 instanceof Data_Maybe.Just) {
                return f(_375.value0)(z);
            };
            throw new Error("Failed pattern match");
        };
    };
});
var foldableEither = new Foldable(function (__dict_Monoid_16) {
    return function (f) {
        return function (_374) {
            if (_374 instanceof Data_Either.Left) {
                return Data_Monoid.mempty(__dict_Monoid_16);
            };
            if (_374 instanceof Data_Either.Right) {
                return f(_374.value0);
            };
            throw new Error("Failed pattern match");
        };
    };
}, function (f) {
    return function (z) {
        return function (_373) {
            if (_373 instanceof Data_Either.Left) {
                return z;
            };
            if (_373 instanceof Data_Either.Right) {
                return f(z)(_373.value0);
            };
            throw new Error("Failed pattern match");
        };
    };
}, function (f) {
    return function (z) {
        return function (_372) {
            if (_372 instanceof Data_Either.Left) {
                return z;
            };
            if (_372 instanceof Data_Either.Right) {
                return f(_372.value0)(z);
            };
            throw new Error("Failed pattern match");
        };
    };
});
var foldableDual = new Foldable(function (__dict_Monoid_17) {
    return function (f) {
        return function (_386) {
            return f(_386);
        };
    };
}, function (f) {
    return function (z) {
        return function (_385) {
            return f(z)(_385);
        };
    };
}, function (f) {
    return function (z) {
        return function (_384) {
            return f(_384)(z);
        };
    };
});
var foldableArray = new Foldable(function (__dict_Monoid_18) {
    return function (f) {
        return function (xs) {
            return foldr(foldableArray)(function (x) {
                return function (acc) {
                    return Prelude["<>"](__dict_Monoid_18["__superclass_Prelude.Semigroup_0"]())(f(x))(acc);
                };
            })(Data_Monoid.mempty(__dict_Monoid_18))(xs);
        };
    };
}, function (f) {
    return function (z) {
        return function (xs) {
            return foldlArray(f)(z)(xs);
        };
    };
}, function (f) {
    return function (z) {
        return function (xs) {
            return foldrArray(f)(z)(xs);
        };
    };
});
var foldableAdditive = new Foldable(function (__dict_Monoid_19) {
    return function (f) {
        return function (_383) {
            return f(_383);
        };
    };
}, function (f) {
    return function (z) {
        return function (_382) {
            return f(z)(_382);
        };
    };
}, function (f) {
    return function (z) {
        return function (_381) {
            return f(_381)(z);
        };
    };
});
var foldMap = function (dict) {
    return dict.foldMap;
};
var foldableFirst = new Foldable(function (__dict_Monoid_20) {
    return function (f) {
        return function (_389) {
            return foldMap(foldableMaybe)(__dict_Monoid_20)(f)(_389);
        };
    };
}, function (f) {
    return function (z) {
        return function (_388) {
            return foldl(foldableMaybe)(f)(z)(_388);
        };
    };
}, function (f) {
    return function (z) {
        return function (_387) {
            return foldr(foldableMaybe)(f)(z)(_387);
        };
    };
});
var foldableLast = new Foldable(function (__dict_Monoid_21) {
    return function (f) {
        return function (_392) {
            return foldMap(foldableMaybe)(__dict_Monoid_21)(f)(_392);
        };
    };
}, function (f) {
    return function (z) {
        return function (_391) {
            return foldl(foldableMaybe)(f)(z)(_391);
        };
    };
}, function (f) {
    return function (z) {
        return function (_390) {
            return foldr(foldableMaybe)(f)(z)(_390);
        };
    };
});
var lookup = function (__dict_Eq_22) {
    return function (__dict_Foldable_23) {
        return function (a) {
            return function (f) {
                return Data_Monoid_First.runFirst(foldMap(__dict_Foldable_23)(Data_Monoid_First.monoidFirst)(function (_371) {
                    var _1659 = Prelude["=="](__dict_Eq_22)(a)(_371.value0);
                    if (_1659) {
                        return new Data_Maybe.Just(_371.value1);
                    };
                    if (!_1659) {
                        return Data_Maybe.Nothing.value;
                    };
                    throw new Error("Failed pattern match");
                })(f));
            };
        };
    };
};
var fold = function (__dict_Foldable_24) {
    return function (__dict_Monoid_25) {
        return foldMap(__dict_Foldable_24)(__dict_Monoid_25)(Prelude.id(Prelude.categoryArr));
    };
};
var find = function (__dict_Foldable_26) {
    return function (p) {
        return function (f) {
            var _1663 = foldMap(__dict_Foldable_26)(Data_Monoid.monoidArray)(function (x) {
                var _1662 = p(x);
                if (_1662) {
                    return [ x ];
                };
                if (!_1662) {
                    return [  ];
                };
                throw new Error("Failed pattern match");
            })(f);
            if (_1663.length >= 1) {
                var _1665 = _1663.slice(1);
                return new Data_Maybe.Just(_1663[0]);
            };
            if (_1663.length === 0) {
                return Data_Maybe.Nothing.value;
            };
            throw new Error("Failed pattern match");
        };
    };
};
var any = function (__dict_Foldable_27) {
    return function (p) {
        return Prelude["<<<"](Prelude.semigroupoidArr)(or(foldableArray))(foldMap(__dict_Foldable_27)(Data_Monoid.monoidArray)(function (x) {
            return [ p(x) ];
        }));
    };
};
var elem = function (__dict_Eq_28) {
    return function (__dict_Foldable_29) {
        return Prelude["<<<"](Prelude.semigroupoidArr)(any(__dict_Foldable_29))(Prelude["=="](__dict_Eq_28));
    };
};
var notElem = function (__dict_Eq_30) {
    return function (__dict_Foldable_31) {
        return function (x) {
            return Prelude["<<<"](Prelude.semigroupoidArr)(Prelude.not(Prelude.boolLikeBoolean))(elem(__dict_Eq_30)(__dict_Foldable_31)(x));
        };
    };
};
var and = function (__dict_Foldable_32) {
    return foldl(__dict_Foldable_32)(Prelude["&&"](Prelude.boolLikeBoolean))(true);
};
var all = function (__dict_Foldable_33) {
    return function (p) {
        return Prelude["<<<"](Prelude.semigroupoidArr)(and(foldableArray))(foldMap(__dict_Foldable_33)(Data_Monoid.monoidArray)(function (x) {
            return [ p(x) ];
        }));
    };
};
module.exports = {
    Foldable: Foldable, 
    foldlArray: foldlArray, 
    foldrArray: foldrArray, 
    lookup: lookup, 
    find: find, 
    notElem: notElem, 
    elem: elem, 
    product: product, 
    sum: sum, 
    all: all, 
    any: any, 
    or: or, 
    and: and, 
    intercalate: intercalate, 
    mconcat: mconcat, 
    sequence_: sequence_, 
    for_: for_, 
    traverse_: traverse_, 
    fold: fold, 
    foldMap: foldMap, 
    foldl: foldl, 
    foldr: foldr, 
    foldableArray: foldableArray, 
    foldableEither: foldableEither, 
    foldableMaybe: foldableMaybe, 
    foldableTuple: foldableTuple, 
    foldableAdditive: foldableAdditive, 
    foldableDual: foldableDual, 
    foldableFirst: foldableFirst, 
    foldableLast: foldableLast, 
    foldableMultiplicative: foldableMultiplicative
};

},{"Control.Apply":28,"Data.Either":74,"Data.Maybe":89,"Data.Monoid":96,"Data.Monoid.Additive":90,"Data.Monoid.Dual":92,"Data.Monoid.First":93,"Data.Monoid.Last":94,"Data.Monoid.Multiplicative":95,"Data.Tuple":108,"Prelude":130}],77:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Foreign = require("Data.Foreign");
var Data_Traversable = require("Data.Traversable");
var Data_Array = require("Data.Array");
var Data_Foreign_Null = require("Data.Foreign.Null");
var Data_Foreign_Undefined = require("Data.Foreign.Undefined");
var Data_Foreign_NullOrUndefined = require("Data.Foreign.NullOrUndefined");
var Data_Either = require("Data.Either");
var Data_Foreign_Index = require("Data.Foreign.Index");
var IsForeign = function (read) {
    this.read = read;
};
var stringIsForeign = new IsForeign(Data_Foreign.readString);
var read = function (dict) {
    return dict.read;
};
var readJSON = function (__dict_IsForeign_0) {
    return function (json) {
        return Prelude[">>="](Data_Either.bindEither)(Data_Foreign.parseJSON(json))(read(__dict_IsForeign_0));
    };
};
var readWith = function (__dict_IsForeign_1) {
    return function (f) {
        return function (value) {
            return Data_Either.either(Prelude["<<<"](Prelude.semigroupoidArr)(Data_Either.Left.create)(f))(Data_Either.Right.create)(read(__dict_IsForeign_1)(value));
        };
    };
};
var readProp = function (__dict_IsForeign_2) {
    return function (__dict_Index_3) {
        return function (prop) {
            return function (value) {
                return Prelude[">>="](Data_Either.bindEither)(Data_Foreign_Index["!"](__dict_Index_3)(value)(prop))(readWith(__dict_IsForeign_2)(Data_Foreign_Index.errorAt(__dict_Index_3)(prop)));
            };
        };
    };
};
var undefinedIsForeign = function (__dict_IsForeign_4) {
    return new IsForeign(Data_Foreign_Undefined.readUndefined(read(__dict_IsForeign_4)));
};
var numberIsForeign = new IsForeign(Data_Foreign.readNumber);
var nullOrUndefinedIsForeign = function (__dict_IsForeign_5) {
    return new IsForeign(Data_Foreign_NullOrUndefined.readNullOrUndefined(read(__dict_IsForeign_5)));
};
var nullIsForeign = function (__dict_IsForeign_6) {
    return new IsForeign(Data_Foreign_Null.readNull(read(__dict_IsForeign_6)));
};
var foreignIsForeign = new IsForeign(function (f) {
    return Prelude["return"](Data_Either.monadEither)(f);
});
var booleanIsForeign = new IsForeign(Data_Foreign.readBoolean);
var arrayIsForeign = function (__dict_IsForeign_7) {
    return new IsForeign(function (value) {
        var readElement = function (i) {
            return function (value_1) {
                return readWith(__dict_IsForeign_7)(Data_Foreign.ErrorAtIndex.create(i))(value_1);
            };
        };
        var readElements = function (arr) {
            return Data_Traversable.sequence(Data_Traversable.traversableArray)(Data_Either.applicativeEither)(Data_Array.zipWith(readElement)(Data_Array.range(0)(Data_Array.length(arr)))(arr));
        };
        return Prelude[">>="](Data_Either.bindEither)(Data_Foreign.readArray(value))(readElements);
    });
};
module.exports = {
    IsForeign: IsForeign, 
    readProp: readProp, 
    readWith: readWith, 
    readJSON: readJSON, 
    read: read, 
    foreignIsForeign: foreignIsForeign, 
    stringIsForeign: stringIsForeign, 
    booleanIsForeign: booleanIsForeign, 
    numberIsForeign: numberIsForeign, 
    arrayIsForeign: arrayIsForeign, 
    nullIsForeign: nullIsForeign, 
    undefinedIsForeign: undefinedIsForeign, 
    nullOrUndefinedIsForeign: nullOrUndefinedIsForeign
};

},{"Data.Array":61,"Data.Either":74,"Data.Foreign":82,"Data.Foreign.Index":78,"Data.Foreign.Null":79,"Data.Foreign.NullOrUndefined":80,"Data.Foreign.Undefined":81,"Data.Traversable":107,"Prelude":130}],78:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Function = require("Data.Function");
var Data_Foreign = require("Data.Foreign");
var Prelude = require("Prelude");
var Data_Either = require("Data.Either");

  function unsafeReadPropImpl(f, s, key, value) {
    return value == null ? f : s(value[key]);
  }
  ;

  function unsafeHasOwnProperty(prop, value) {
    return Object.prototype.hasOwnProperty.call(value, prop);
  }
  ;

  function unsafeHasProperty(prop, value) {
    return prop in value;
  }
  ;
var Index = function ($bang, errorAt, hasOwnProperty, hasProperty) {
    this["!"] = $bang;
    this.errorAt = errorAt;
    this.hasOwnProperty = hasOwnProperty;
    this.hasProperty = hasProperty;
};
var $bang = function (dict) {
    return dict["!"];
};
var unsafeReadProp = function (k) {
    return function (value) {
        return unsafeReadPropImpl(new Data_Either.Left(new Data_Foreign.TypeMismatch("object", Data_Foreign.typeOf(value))), Prelude.pure(Data_Either.applicativeEither), k, value);
    };
};
var prop = unsafeReadProp;
var index = unsafeReadProp;
var hasPropertyImpl = function (prop_1) {
    return function (value) {
        if (Data_Foreign.isNull(value)) {
            return false;
        };
        if (Data_Foreign.isUndefined(value)) {
            return false;
        };
        if (Data_Foreign.typeOf(value) === "object" || Data_Foreign.typeOf(value) === "function") {
            return unsafeHasProperty(prop_1, value);
        };
        return false;
    };
};
var hasProperty = function (dict) {
    return dict.hasProperty;
};
var hasOwnPropertyImpl = function (prop_1) {
    return function (value) {
        if (Data_Foreign.isNull(value)) {
            return false;
        };
        if (Data_Foreign.isUndefined(value)) {
            return false;
        };
        if (Data_Foreign.typeOf(value) === "object" || Data_Foreign.typeOf(value) === "function") {
            return unsafeHasOwnProperty(prop_1, value);
        };
        return false;
    };
};
var indexNumber = new Index(Prelude.flip(index), Data_Foreign.ErrorAtIndex.create, hasOwnPropertyImpl, hasPropertyImpl);
var indexString = new Index(Prelude.flip(prop), Data_Foreign.ErrorAtProperty.create, hasOwnPropertyImpl, hasPropertyImpl);
var hasOwnProperty = function (dict) {
    return dict.hasOwnProperty;
};
var errorAt = function (dict) {
    return dict.errorAt;
};
module.exports = {
    Index: Index, 
    errorAt: errorAt, 
    hasOwnProperty: hasOwnProperty, 
    hasProperty: hasProperty, 
    "!": $bang, 
    index: index, 
    prop: prop, 
    indexString: indexString, 
    indexNumber: indexNumber
};

},{"Data.Either":74,"Data.Foreign":82,"Data.Function":83,"Prelude":130}],79:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Foreign = require("Data.Foreign");
var Prelude = require("Prelude");
var Data_Maybe = require("Data.Maybe");
var Data_Either = require("Data.Either");
var Null = function (x) {
    return x;
};
var runNull = function (_165) {
    return _165;
};
var readNull = function (f) {
    return function (value) {
        if (Data_Foreign.isNull(value)) {
            return Prelude.pure(Data_Either.applicativeEither)(Data_Maybe.Nothing.value);
        };
        return Prelude["<$>"](Data_Either.functorEither)(Prelude["<<<"](Prelude.semigroupoidArr)(Null)(Data_Maybe.Just.create))(f(value));
    };
};
module.exports = {
    Null: Null, 
    readNull: readNull, 
    runNull: runNull
};

},{"Data.Either":74,"Data.Foreign":82,"Data.Maybe":89,"Prelude":130}],80:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Foreign = require("Data.Foreign");
var Data_Maybe = require("Data.Maybe");
var Data_Either = require("Data.Either");
var NullOrUndefined = function (x) {
    return x;
};
var runNullOrUndefined = function (_166) {
    return _166;
};
var readNullOrUndefined = function (f) {
    return function (value) {
        if (Data_Foreign.isNull(value) || Data_Foreign.isUndefined(value)) {
            return Prelude.pure(Data_Either.applicativeEither)(Data_Maybe.Nothing.value);
        };
        return Prelude["<$>"](Data_Either.functorEither)(Prelude["<<<"](Prelude.semigroupoidArr)(NullOrUndefined)(Data_Maybe.Just.create))(f(value));
    };
};
module.exports = {
    NullOrUndefined: NullOrUndefined, 
    readNullOrUndefined: readNullOrUndefined, 
    runNullOrUndefined: runNullOrUndefined
};

},{"Data.Either":74,"Data.Foreign":82,"Data.Maybe":89,"Prelude":130}],81:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Foreign = require("Data.Foreign");
var Prelude = require("Prelude");
var Data_Maybe = require("Data.Maybe");
var Data_Either = require("Data.Either");
var Undefined = function (x) {
    return x;
};
var runUndefined = function (_167) {
    return _167;
};
var readUndefined = function (f) {
    return function (value) {
        if (Data_Foreign.isUndefined(value)) {
            return Prelude.pure(Data_Either.applicativeEither)(Data_Maybe.Nothing.value);
        };
        return Prelude["<$>"](Data_Either.functorEither)(Prelude["<<<"](Prelude.semigroupoidArr)(Undefined)(Data_Maybe.Just.create))(f(value));
    };
};
module.exports = {
    Undefined: Undefined, 
    readUndefined: readUndefined, 
    runUndefined: runUndefined
};

},{"Data.Either":74,"Data.Foreign":82,"Data.Maybe":89,"Prelude":130}],82:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Function = require("Data.Function");
var Data_Array = require("Data.Array");
var Data_Either = require("Data.Either");

  function parseJSONImpl(left, right, str) {
    try {
      return right(JSON.parse(str));
    } catch (e) {
      return left(e.toString());
    }
  }
  ;

  function toForeign(value) {
    return value;
  }
  ;

  function unsafeFromForeign(value) {
    return value;
  }
  ;

  function typeOf(value) {
    return typeof value;
  }
  ;

  function tagOf(value) {
    return Object.prototype.toString.call(value).slice(8, -1);
  }
  ;

  function isNull(value) {
    return value === null;
  }
  ;

  function isUndefined(value) {
    return value === undefined;
  }
  ;

  var isArray = Array.isArray || function(value) {
    return Object.prototype.toString.call(value) === '[object Array]';
  };
  ;
var TypeMismatch = (function () {
    function TypeMismatch(value0, value1) {
        this.value0 = value0;
        this.value1 = value1;
    };
    TypeMismatch.create = function (value0) {
        return function (value1) {
            return new TypeMismatch(value0, value1);
        };
    };
    return TypeMismatch;
})();
var ErrorAtIndex = (function () {
    function ErrorAtIndex(value0, value1) {
        this.value0 = value0;
        this.value1 = value1;
    };
    ErrorAtIndex.create = function (value0) {
        return function (value1) {
            return new ErrorAtIndex(value0, value1);
        };
    };
    return ErrorAtIndex;
})();
var ErrorAtProperty = (function () {
    function ErrorAtProperty(value0, value1) {
        this.value0 = value0;
        this.value1 = value1;
    };
    ErrorAtProperty.create = function (value0) {
        return function (value1) {
            return new ErrorAtProperty(value0, value1);
        };
    };
    return ErrorAtProperty;
})();
var JSONError = (function () {
    function JSONError(value0) {
        this.value0 = value0;
    };
    JSONError.create = function (value0) {
        return new JSONError(value0);
    };
    return JSONError;
})();
var unsafeReadTagged = function (tag) {
    return function (value) {
        if (tagOf(value) === tag) {
            return Prelude.pure(Data_Either.applicativeEither)(unsafeFromForeign(value));
        };
        return new Data_Either.Left(new TypeMismatch(tag, tagOf(value)));
    };
};
var showForeignError = new Prelude.Show(function (_161) {
    if (_161 instanceof TypeMismatch) {
        return "Type mismatch: expected " + (_161.value0 + (", found " + _161.value1));
    };
    if (_161 instanceof ErrorAtIndex) {
        return "Error at array index " + (Prelude.show(Prelude.showNumber)(_161.value0) + (": " + Prelude.show(showForeignError)(_161.value1)));
    };
    if (_161 instanceof ErrorAtProperty) {
        return "Error at property " + (Prelude.show(Prelude.showString)(_161.value0) + (": " + Prelude.show(showForeignError)(_161.value1)));
    };
    if (_161 instanceof JSONError) {
        return "JSON error: " + _161.value0;
    };
    throw new Error("Failed pattern match");
});
var readString = unsafeReadTagged("String");
var readNumber = unsafeReadTagged("Number");
var readBoolean = unsafeReadTagged("Boolean");
var readArray = function (value) {
    if (isArray(value)) {
        return Prelude.pure(Data_Either.applicativeEither)(unsafeFromForeign(value));
    };
    return new Data_Either.Left(new TypeMismatch("array", tagOf(value)));
};
var parseJSON = function (json) {
    return parseJSONImpl(Prelude["<<<"](Prelude.semigroupoidArr)(Data_Either.Left.create)(JSONError.create), Data_Either.Right.create, json);
};
var eqForeignError = new Prelude.Eq(function (a) {
    return function (b) {
        return !Prelude["=="](eqForeignError)(a)(b);
    };
}, function (_162) {
    return function (_163) {
        if (_162 instanceof TypeMismatch && _163 instanceof TypeMismatch) {
            return _162.value0 === _163.value0 && _162.value1 === _163.value1;
        };
        if (_162 instanceof ErrorAtIndex && _163 instanceof ErrorAtIndex) {
            return _162.value0 === _163.value0 && Prelude["=="](eqForeignError)(_162.value1)(_163.value1);
        };
        if (_162 instanceof ErrorAtProperty && _163 instanceof ErrorAtProperty) {
            return _162.value0 === _163.value0 && Prelude["=="](eqForeignError)(_162.value1)(_163.value1);
        };
        if (_162 instanceof JSONError && _163 instanceof JSONError) {
            return _162.value0 === _163.value0;
        };
        return false;
    };
});
module.exports = {
    TypeMismatch: TypeMismatch, 
    ErrorAtIndex: ErrorAtIndex, 
    ErrorAtProperty: ErrorAtProperty, 
    JSONError: JSONError, 
    readArray: readArray, 
    readNumber: readNumber, 
    readBoolean: readBoolean, 
    readString: readString, 
    isArray: isArray, 
    isUndefined: isUndefined, 
    isNull: isNull, 
    tagOf: tagOf, 
    typeOf: typeOf, 
    unsafeReadTagged: unsafeReadTagged, 
    unsafeFromForeign: unsafeFromForeign, 
    toForeign: toForeign, 
    parseJSON: parseJSON, 
    showForeignError: showForeignError, 
    eqForeignError: eqForeignError
};

},{"Data.Array":61,"Data.Either":74,"Data.Function":83,"Prelude":130}],83:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");

    function mkFn0(fn) {
      return function() {
        return fn({});
      };
    }
    ;

    function mkFn1(fn) {
      return function(a) {
        return fn(a);
      };
    }
    ;

    function mkFn2(fn) {
      return function(a, b) {
        return fn(a)(b);
      };
    }
    ;

    function mkFn3(fn) {
      return function(a, b, c) {
        return fn(a)(b)(c);
      };
    }
    ;

    function mkFn4(fn) {
      return function(a, b, c, d) {
        return fn(a)(b)(c)(d);
      };
    }
    ;

    function mkFn5(fn) {
      return function(a, b, c, d, e) {
        return fn(a)(b)(c)(d)(e);
      };
    }
    ;

    function mkFn6(fn) {
      return function(a, b, c, d, e, f) {
        return fn(a)(b)(c)(d)(e)(f);
      };
    }
    ;

    function mkFn7(fn) {
      return function(a, b, c, d, e, f, g) {
        return fn(a)(b)(c)(d)(e)(f)(g);
      };
    }
    ;

    function mkFn8(fn) {
      return function(a, b, c, d, e, f, g, h) {
        return fn(a)(b)(c)(d)(e)(f)(g)(h);
      };
    }
    ;

    function mkFn9(fn) {
      return function(a, b, c, d, e, f, g, h, i) {
        return fn(a)(b)(c)(d)(e)(f)(g)(h)(i);
      };
    }
    ;

    function mkFn10(fn) {
      return function(a, b, c, d, e, f, g, h, i, j) {
        return fn(a)(b)(c)(d)(e)(f)(g)(h)(i)(j);
      };
    }
    ;

    function runFn0(fn) {
      return fn();
    }
    ;

    function runFn1(fn) {
      return function(a) {
        return fn(a);
      };
    }
    ;

    function runFn2(fn) {
      return function(a) {
        return function(b) {
          return fn(a, b);
        };
      };
    }
    ;

    function runFn3(fn) {
      return function(a) {
        return function(b) {
          return function(c) {
            return fn(a, b, c);
          };
        };
      };
    }
    ;

    function runFn4(fn) {
      return function(a) {
        return function(b) {
          return function(c) {
            return function(d) {
              return fn(a, b, c, d);
            };
          };
        };
      };
    }
    ;

    function runFn5(fn) {
      return function(a) {
        return function(b) {
          return function(c) {
            return function(d) {
              return function(e) {
                return fn(a, b, c, d, e);
              };
            };
          };
        };
      };
    }
    ;

    function runFn6(fn) {
      return function(a) {
        return function(b) {
          return function(c) {
            return function(d) {
              return function(e) {
                return function(f) {
                  return fn(a, b, c, d, e, f);
                };
              };
            };
          };
        };
      };
    }
    ;

    function runFn7(fn) {
      return function(a) {
        return function(b) {
          return function(c) {
            return function(d) {
              return function(e) {
                return function(f) {
                  return function(g) {
                    return fn(a, b, c, d, e, f, g);
                  };
                };
              };
            };
          };
        };
      };
    }
    ;

    function runFn8(fn) {
      return function(a) {
        return function(b) {
          return function(c) {
            return function(d) {
              return function(e) {
                return function(f) {
                  return function(g) {
                    return function(h) {
                      return fn(a, b, c, d, e, f, g, h);
                    };
                  };
                };
              };
            };
          };
        };
      };
    }
    ;

    function runFn9(fn) {
      return function(a) {
        return function(b) {
          return function(c) {
            return function(d) {
              return function(e) {
                return function(f) {
                  return function(g) {
                    return function(h) {
                      return function(i) {
                        return fn(a, b, c, d, e, f, g, h, i);
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    }
    ;

    function runFn10(fn) {
      return function(a) {
        return function(b) {
          return function(c) {
            return function(d) {
              return function(e) {
                return function(f) {
                  return function(g) {
                    return function(h) {
                      return function(i) {
                        return function(j) {
                          return fn(a, b, c, d, e, f, g, h, i, j);
                        };
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    }
    ;
var on = function (f) {
    return function (g) {
        return function (x) {
            return function (y) {
                return f(g(x))(g(y));
            };
        };
    };
};
module.exports = {
    runFn10: runFn10, 
    runFn9: runFn9, 
    runFn8: runFn8, 
    runFn7: runFn7, 
    runFn6: runFn6, 
    runFn5: runFn5, 
    runFn4: runFn4, 
    runFn3: runFn3, 
    runFn2: runFn2, 
    runFn1: runFn1, 
    runFn0: runFn0, 
    mkFn10: mkFn10, 
    mkFn9: mkFn9, 
    mkFn8: mkFn8, 
    mkFn7: mkFn7, 
    mkFn6: mkFn6, 
    mkFn5: mkFn5, 
    mkFn4: mkFn4, 
    mkFn3: mkFn3, 
    mkFn2: mkFn2, 
    mkFn1: mkFn1, 
    mkFn0: mkFn0, 
    on: on
};

},{"Prelude":130}],84:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Contravariant = function ($greater$dollar$less) {
    this[">$<"] = $greater$dollar$less;
};
var $greater$dollar$less = function (dict) {
    return dict[">$<"];
};
var $greater$hash$less = function (__dict_Contravariant_0) {
    return function (x) {
        return function (f) {
            return $greater$dollar$less(__dict_Contravariant_0)(f)(x);
        };
    };
};
module.exports = {
    Contravariant: Contravariant, 
    ">#<": $greater$hash$less, 
    ">$<": $greater$dollar$less
};

},{"Prelude":130}],85:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Comonad = require("Control.Comonad");
var Control_Extend = require("Control.Extend");
var Data_Foldable = require("Data.Foldable");
var Data_Traversable = require("Data.Traversable");
var Identity = function (x) {
    return x;
};
var showConst = function (__dict_Show_2) {
    return new Prelude.Show(function (_517) {
        return "Identity (" + (Prelude.show(__dict_Show_2)(_517) + ")");
    });
};
var runIdentity = function (_512) {
    return _512;
};
var functorIdentity = new Prelude.Functor(function (f) {
    return function (_518) {
        return f(_518);
    };
});
var foldableIdentity = new Data_Foldable.Foldable(function (__dict_Monoid_4) {
    return function (f) {
        return function (_524) {
            return f(_524);
        };
    };
}, function (f) {
    return function (z) {
        return function (_523) {
            return f(z)(_523);
        };
    };
}, function (f) {
    return function (z) {
        return function (_522) {
            return f(_522)(z);
        };
    };
});
var traversableIdentity = new Data_Traversable.Traversable(function () {
    return foldableIdentity;
}, function () {
    return functorIdentity;
}, function (__dict_Applicative_1) {
    return function (_526) {
        return Prelude["<$>"]((__dict_Applicative_1["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Identity)(_526);
    };
}, function (__dict_Applicative_0) {
    return function (f) {
        return function (_525) {
            return Prelude["<$>"]((__dict_Applicative_0["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Identity)(f(_525));
        };
    };
});
var extendIdentity = new Control_Extend.Extend(function (f) {
    return function (m) {
        return f(m);
    };
}, function () {
    return functorIdentity;
});
var eqIdentity = function (__dict_Eq_5) {
    return new Prelude.Eq(function (x) {
        return function (y) {
            return !Prelude["=="](eqIdentity(__dict_Eq_5))(x)(y);
        };
    }, function (_513) {
        return function (_514) {
            return Prelude["=="](__dict_Eq_5)(_513)(_514);
        };
    });
};
var ordIdentity = function (__dict_Ord_3) {
    return new Prelude.Ord(function () {
        return eqIdentity(__dict_Ord_3["__superclass_Prelude.Eq_0"]());
    }, function (_515) {
        return function (_516) {
            return Prelude.compare(__dict_Ord_3)(_515)(_516);
        };
    });
};
var comonadIdentity = new Control_Comonad.Comonad(function () {
    return extendIdentity;
}, function (_521) {
    return _521;
});
var applyIdentity = new Prelude.Apply(function (_519) {
    return function (_520) {
        return _519(_520);
    };
}, function () {
    return functorIdentity;
});
var bindIdentity = new Prelude.Bind(function (m) {
    return function (f) {
        return f(runIdentity(m));
    };
}, function () {
    return applyIdentity;
});
var applicativeIdentity = new Prelude.Applicative(function () {
    return applyIdentity;
}, Identity);
var monadIdentity = new Prelude.Monad(function () {
    return applicativeIdentity;
}, function () {
    return bindIdentity;
});
module.exports = {
    Identity: Identity, 
    runIdentity: runIdentity, 
    eqIdentity: eqIdentity, 
    ordIdentity: ordIdentity, 
    showConst: showConst, 
    functorIdentity: functorIdentity, 
    applyIdentity: applyIdentity, 
    applicativeIdentity: applicativeIdentity, 
    bindIdentity: bindIdentity, 
    monadIdentity: monadIdentity, 
    extendIdentity: extendIdentity, 
    comonadIdentity: comonadIdentity, 
    foldableIdentity: foldableIdentity, 
    traversableIdentity: traversableIdentity
};

},{"Control.Comonad":30,"Control.Extend":31,"Data.Foldable":76,"Data.Traversable":107,"Prelude":130}],86:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");

  function fromNumber(n) {
    return n|0;
  }
  ;

  function intAdd(x) {
    return function(y) {
      return (x + y)|0;
    };
  }
  ;

  function intMul(x) {
    return function(y) {
      return (x * y)|0;
    };
  }
  ;

  function intDiv(x) {
    return function(y) {
      return (x / y)|0;
    };
  }
  ;

  function intMod(x) {
    return function(y) {
      return x % y;
    };
  }
  ;

  function intSub(x) {
    return function(y) {
      return (x - y)|0;
    };
  }
  ;
var Int = function (x) {
    return x;
};
var toNumber = function (_16) {
    return _16;
};
var showInt = new Prelude.Show(function (_17) {
    return "fromNumber " + Prelude.show(Prelude.showNumber)(_17);
});
var semiringInt = new Prelude.Semiring(intMul, intAdd, 1, 0);
var ringInt = new Prelude.Ring(intSub, function () {
    return semiringInt;
});
var moduloSemiringInt = new Prelude.ModuloSemiring(intDiv, function () {
    return semiringInt;
}, intMod);
var eqInt = new Prelude.Eq(function (_20) {
    return function (_21) {
        return _20 !== _21;
    };
}, function (_18) {
    return function (_19) {
        return _18 === _19;
    };
});
var ordInt = new Prelude.Ord(function () {
    return eqInt;
}, function (_22) {
    return function (_23) {
        return Prelude.compare(Prelude.ordNumber)(_22)(_23);
    };
});
module.exports = {
    toNumber: toNumber, 
    fromNumber: fromNumber, 
    showInt: showInt, 
    eqInt: eqInt, 
    ordInt: ordInt, 
    semiringInt: semiringInt, 
    moduloSemiringInt: moduloSemiringInt, 
    ringInt: ringInt
};

},{"Prelude":130}],87:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Lazy = require("Control.Lazy");
var Control_Extend = require("Control.Extend");
var Control_Comonad = require("Control.Comonad");
function defer(thunk) {    if (this instanceof defer) {      this.thunk = thunk;      return this;    } else {      return new defer(thunk);    }}defer.prototype.force = function () {    var value = this.thunk();    delete this.thunk;    this.force = function () {        return value;    };    return value;};;
function force(l) {  return l.force();};
var showLazy = function (__dict_Show_0) {
    return new Prelude.Show(function (x) {
        return "Lazy " + Prelude.show(__dict_Show_0)(force(x));
    });
};
var lazy1Lazy = new Control_Lazy.Lazy1(function (f) {
    return defer(function (_119) {
        return force(f(Prelude.unit));
    });
});
var functorLazy = new Prelude.Functor(function (f) {
    return function (l) {
        return defer(function (_114) {
            return f(force(l));
        });
    };
});
var extendLazy = new Control_Extend.Extend(function (f) {
    return function (x) {
        return defer(function (_118) {
            return f(x);
        });
    };
}, function () {
    return functorLazy;
});
var eqLazy = function (__dict_Eq_2) {
    return new Prelude.Eq(function (x) {
        return function (y) {
            return !Prelude["=="](eqLazy(__dict_Eq_2))(x)(y);
        };
    }, function (x) {
        return function (y) {
            return Prelude["=="](__dict_Eq_2)(force(x))(force(y));
        };
    });
};
var ordLazy = function (__dict_Ord_1) {
    return new Prelude.Ord(function () {
        return eqLazy(__dict_Ord_1["__superclass_Prelude.Eq_0"]());
    }, function (x) {
        return function (y) {
            return Prelude.compare(__dict_Ord_1)(force(x))(force(y));
        };
    });
};
var comonadLazy = new Control_Comonad.Comonad(function () {
    return extendLazy;
}, force);
var applyLazy = new Prelude.Apply(function (f) {
    return function (x) {
        return defer(function (_115) {
            return force(f)(force(x));
        });
    };
}, function () {
    return functorLazy;
});
var bindLazy = new Prelude.Bind(function (l) {
    return function (f) {
        return defer(function (_117) {
            return Prelude["<<<"](Prelude.semigroupoidArr)(force)(Prelude["<<<"](Prelude.semigroupoidArr)(f)(force))(l);
        });
    };
}, function () {
    return applyLazy;
});
var applicativeLazy = new Prelude.Applicative(function () {
    return applyLazy;
}, function (a) {
    return defer(function (_116) {
        return a;
    });
});
var monadLazy = new Prelude.Monad(function () {
    return applicativeLazy;
}, function () {
    return bindLazy;
});
module.exports = {
    force: force, 
    defer: defer, 
    functorLazy: functorLazy, 
    applyLazy: applyLazy, 
    applicativeLazy: applicativeLazy, 
    bindLazy: bindLazy, 
    monadLazy: monadLazy, 
    extendLazy: extendLazy, 
    comonadLazy: comonadLazy, 
    eqLazy: eqLazy, 
    ordLazy: ordLazy, 
    showLazy: showLazy, 
    lazy1Lazy: lazy1Lazy
};

},{"Control.Comonad":30,"Control.Extend":31,"Control.Lazy":33,"Prelude":130}],88:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Foldable = require("Data.Foldable");
var Data_Monoid = require("Data.Monoid");
var Data_Traversable = require("Data.Traversable");
var Data_Unfoldable = require("Data.Unfoldable");
var Data_Maybe = require("Data.Maybe");
var Data_Tuple = require("Data.Tuple");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var Control_MonadPlus = require("Control.MonadPlus");
var Nil = (function () {
    function Nil() {

    };
    Nil.value = new Nil();
    return Nil;
})();
var Cons = (function () {
    function Cons(value0, value1) {
        this.value0 = value0;
        this.value1 = value1;
    };
    Cons.create = function (value0) {
        return function (value1) {
            return new Cons(value0, value1);
        };
    };
    return Cons;
})();
var $bang = function (__copy__630) {
    return function (__copy__631) {
        var _630 = __copy__630;
        var _631 = __copy__631;
        tco: while (true) {
            if (_630 instanceof Nil) {
                return Data_Maybe.Nothing.value;
            };
            if (_630 instanceof Cons && _631 === 0) {
                return new Data_Maybe.Just(_630.value0);
            };
            if (_630 instanceof Cons) {
                var __tco__630 = _630.value1;
                var __tco__631 = _631 - 1;
                _630 = __tco__630;
                _631 = __tco__631;
                continue tco;
            };
            throw new Error("Failed pattern match");
        };
    };
};
var zipWith = function (f) {
    return function (_644) {
        return function (_645) {
            if (_644 instanceof Nil) {
                return Nil.value;
            };
            if (_645 instanceof Nil) {
                return Nil.value;
            };
            if (_644 instanceof Cons && _645 instanceof Cons) {
                return new Cons(f(_644.value0)(_645.value0), zipWith(f)(_644.value1)(_645.value1));
            };
            throw new Error("Failed pattern match");
        };
    };
};
var unfoldableList = new Data_Unfoldable.Unfoldable(function (f) {
    return function (b) {
        var go = function (_670) {
            if (_670 instanceof Data_Maybe.Nothing) {
                return Nil.value;
            };
            if (_670 instanceof Data_Maybe.Just) {
                return new Cons(_670.value0.value0, go(f(_670.value0.value1)));
            };
            throw new Error("Failed pattern match");
        };
        return go(f(b));
    };
});
var uncons = function (_641) {
    if (_641 instanceof Nil) {
        return Data_Maybe.Nothing.value;
    };
    if (_641 instanceof Cons) {
        return Data_Maybe.Just.create(new Data_Tuple.Tuple(_641.value0, _641.value1));
    };
    throw new Error("Failed pattern match");
};
var toArray = (function () {
    var step = function (_675) {
        if (_675 instanceof Nil) {
            return Data_Maybe.Nothing.value;
        };
        if (_675 instanceof Cons) {
            return new Data_Maybe.Just(new Data_Tuple.Tuple(_675.value0, _675.value1));
        };
        throw new Error("Failed pattern match");
    };
    return Data_Unfoldable.unfoldr(Data_Unfoldable.unfoldableArray)(step);
})();
var take = function (_634) {
    return function (_635) {
        if (_634 === 0) {
            return Nil.value;
        };
        if (_635 instanceof Nil) {
            return Nil.value;
        };
        if (_635 instanceof Cons) {
            return new Cons(_635.value0, take(_634 - 1)(_635.value1));
        };
        throw new Error("Failed pattern match");
    };
};
var tail = function (_640) {
    if (_640 instanceof Nil) {
        return Data_Maybe.Nothing.value;
    };
    if (_640 instanceof Cons) {
        return new Data_Maybe.Just(_640.value1);
    };
    throw new Error("Failed pattern match");
};
var span = function (p) {
    return function (_647) {
        if (_647 instanceof Cons) {
            if (p(_647.value0)) {
                var _2770 = span(p)(_647.value1);
                return new Data_Tuple.Tuple(new Cons(_647.value0, _2770.value0), _2770.value1);
            };
            if (Prelude.otherwise) {
                return new Data_Tuple.Tuple(Nil.value, _647);
            };
        };
        throw new Error("Failed pattern match");
    };
};
var singleton = function (a) {
    return new Cons(a, Nil.value);
};
var showList = function (__dict_Show_2) {
    return new Prelude.Show(function (_660) {
        if (_660 instanceof Nil) {
            return "Nil";
        };
        if (_660 instanceof Cons) {
            return "Cons (" + (Prelude.show(__dict_Show_2)(_660.value0) + (") (" + (Prelude.show(showList(__dict_Show_2))(_660.value1) + ")")));
        };
        throw new Error("Failed pattern match");
    });
};
var semigroupList = new Prelude.Semigroup(function (_665) {
    return function (ys) {
        if (_665 instanceof Nil) {
            return ys;
        };
        if (_665 instanceof Cons) {
            return new Cons(_665.value0, Prelude["<>"](semigroupList)(_665.value1)(ys));
        };
        throw new Error("Failed pattern match");
    };
});
var reverse = (function () {
    var go = function (__copy_acc) {
        return function (__copy__676) {
            var acc = __copy_acc;
            var _676 = __copy__676;
            tco: while (true) {
                if (_676 instanceof Nil) {
                    return acc;
                };
                if (_676 instanceof Cons) {
                    var __tco_acc = new Cons(_676.value0, acc);
                    var __tco__676 = _676.value1;
                    acc = __tco_acc;
                    _676 = __tco__676;
                    continue tco;
                };
                throw new Error("Failed pattern match");
            };
        };
    };
    return go(Nil.value);
})();
var $$null = function (_646) {
    if (_646 instanceof Nil) {
        return true;
    };
    return false;
};
var monoidList = new Data_Monoid.Monoid(function () {
    return semigroupList;
}, Nil.value);
var mapMaybe = function (f) {
    return function (_638) {
        if (_638 instanceof Nil) {
            return Nil.value;
        };
        if (_638 instanceof Cons) {
            var _2789 = f(_638.value0);
            if (_2789 instanceof Data_Maybe.Nothing) {
                return mapMaybe(f)(_638.value1);
            };
            if (_2789 instanceof Data_Maybe.Just) {
                return new Cons(_2789.value0, mapMaybe(f)(_638.value1));
            };
            throw new Error("Failed pattern match");
        };
        throw new Error("Failed pattern match");
    };
};
var length = function (_636) {
    if (_636 instanceof Nil) {
        return 0;
    };
    if (_636 instanceof Cons) {
        return 1 + length(_636.value1);
    };
    throw new Error("Failed pattern match");
};
var last = function (__copy__642) {
    var _642 = __copy__642;
    tco: while (true) {
        if (_642 instanceof Cons && _642.value1 instanceof Nil) {
            return new Data_Maybe.Just(_642.value0);
        };
        if (_642 instanceof Cons) {
            var __tco__642 = _642.value1;
            _642 = __tco__642;
            continue tco;
        };
        return Data_Maybe.Nothing.value;
    };
};
var insertBy = function (cmp) {
    return function (x) {
        return function (_649) {
            if (_649 instanceof Nil) {
                return new Cons(x, Nil.value);
            };
            if (_649 instanceof Cons) {
                var _2804 = cmp(x)(_649.value0);
                if (_2804 instanceof Prelude.GT) {
                    return new Cons(_649.value0, insertBy(cmp)(x)(_649.value1));
                };
                return new Cons(x, _649);
            };
            throw new Error("Failed pattern match");
        };
    };
};
var insertAt = function (_650) {
    return function (x) {
        return function (_651) {
            if (_650 === 0) {
                return new Data_Maybe.Just(new Cons(x, _651));
            };
            if (_651 instanceof Cons) {
                return Prelude["<$>"](Data_Maybe.functorMaybe)(Cons.create(_651.value0))(insertAt(_650 - 1)(x)(_651.value1));
            };
            return Data_Maybe.Nothing.value;
        };
    };
};
var insert = function (__dict_Ord_4) {
    return insertBy(Prelude.compare(__dict_Ord_4));
};
var init = function (_643) {
    if (_643 instanceof Cons && _643.value1 instanceof Nil) {
        return new Data_Maybe.Just(Nil.value);
    };
    if (_643 instanceof Cons) {
        return Prelude["<$>"](Data_Maybe.functorMaybe)(Cons.create(_643.value0))(init(_643.value1));
    };
    return Data_Maybe.Nothing.value;
};
var head = function (_639) {
    if (_639 instanceof Nil) {
        return Data_Maybe.Nothing.value;
    };
    if (_639 instanceof Cons) {
        return new Data_Maybe.Just(_639.value0);
    };
    throw new Error("Failed pattern match");
};
var groupBy = function (eq) {
    return function (_648) {
        if (_648 instanceof Nil) {
            return Nil.value;
        };
        if (_648 instanceof Cons) {
            var _2822 = span(eq(_648.value0))(_648.value1);
            return new Cons(new Cons(_648.value0, _2822.value0), groupBy(eq)(_2822.value1));
        };
        throw new Error("Failed pattern match");
    };
};
var group = function (__dict_Eq_5) {
    return groupBy(Prelude["=="](__dict_Eq_5));
};
var functorList = new Prelude.Functor(function (f) {
    return function (_666) {
        if (_666 instanceof Nil) {
            return Nil.value;
        };
        if (_666 instanceof Cons) {
            return new Cons(f(_666.value0), Prelude["<$>"](functorList)(f)(_666.value1));
        };
        throw new Error("Failed pattern match");
    };
});
var fromArray = Data_Foldable.foldr(Data_Foldable.foldableArray)(Cons.create)(Nil.value);
var foldableList = new Data_Foldable.Foldable(function (__dict_Monoid_6) {
    return function (f) {
        return function (_669) {
            if (_669 instanceof Nil) {
                return Data_Monoid.mempty(__dict_Monoid_6);
            };
            if (_669 instanceof Cons) {
                return Prelude["<>"](__dict_Monoid_6["__superclass_Prelude.Semigroup_0"]())(f(_669.value0))(Data_Foldable.foldMap(foldableList)(__dict_Monoid_6)(f)(_669.value1));
            };
            throw new Error("Failed pattern match");
        };
    };
}, function (o) {
    return function (b) {
        return function (_668) {
            if (_668 instanceof Nil) {
                return b;
            };
            if (_668 instanceof Cons) {
                return Data_Foldable.foldl(foldableList)(o)(o(b)(_668.value0))(_668.value1);
            };
            throw new Error("Failed pattern match");
        };
    };
}, function (o) {
    return function (b) {
        return function (_667) {
            if (_667 instanceof Nil) {
                return b;
            };
            if (_667 instanceof Cons) {
                return o(_667.value0)(Data_Foldable.foldr(foldableList)(o)(b)(_667.value1));
            };
            throw new Error("Failed pattern match");
        };
    };
});
var traversableList = new Data_Traversable.Traversable(function () {
    return foldableList;
}, function () {
    return functorList;
}, function (__dict_Applicative_1) {
    return function (_672) {
        if (_672 instanceof Nil) {
            return Prelude.pure(__dict_Applicative_1)(Nil.value);
        };
        if (_672 instanceof Cons) {
            return Prelude["<*>"](__dict_Applicative_1["__superclass_Prelude.Apply_0"]())(Prelude["<$>"]((__dict_Applicative_1["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Cons.create)(_672.value0))(Data_Traversable.sequence(traversableList)(__dict_Applicative_1)(_672.value1));
        };
        throw new Error("Failed pattern match");
    };
}, function (__dict_Applicative_0) {
    return function (f) {
        return function (_671) {
            if (_671 instanceof Nil) {
                return Prelude.pure(__dict_Applicative_0)(Nil.value);
            };
            if (_671 instanceof Cons) {
                return Prelude["<*>"](__dict_Applicative_0["__superclass_Prelude.Apply_0"]())(Prelude["<$>"]((__dict_Applicative_0["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Cons.create)(f(_671.value0)))(Data_Traversable.traverse(traversableList)(__dict_Applicative_0)(f)(_671.value1));
            };
            throw new Error("Failed pattern match");
        };
    };
});
var filter = function (p) {
    return function (_637) {
        if (_637 instanceof Nil) {
            return Nil.value;
        };
        if (_637 instanceof Cons && p(_637.value0)) {
            return new Cons(_637.value0, filter(p)(_637.value1));
        };
        if (_637 instanceof Cons) {
            return filter(p)(_637.value1);
        };
        throw new Error("Failed pattern match");
    };
};
var intersectBy = function (eq) {
    return function (_658) {
        return function (_659) {
            if (_658 instanceof Nil) {
                return Nil.value;
            };
            if (_659 instanceof Nil) {
                return Nil.value;
            };
            return filter(function (x) {
                return Data_Foldable.any(foldableList)(eq(x))(_659);
            })(_658);
        };
    };
};
var intersect = function (__dict_Eq_7) {
    return intersectBy(Prelude["=="](__dict_Eq_7));
};
var nubBy = function ($eq$eq) {
    return function (_657) {
        if (_657 instanceof Nil) {
            return Nil.value;
        };
        if (_657 instanceof Cons) {
            return new Cons(_657.value0, nubBy($eq$eq)(filter(function (y) {
                return !$eq$eq(_657.value0)(y);
            })(_657.value1)));
        };
        throw new Error("Failed pattern match");
    };
};
var nub = function (__dict_Eq_8) {
    return nubBy(Prelude["=="](__dict_Eq_8));
};
var eqList = function (__dict_Eq_9) {
    return new Prelude.Eq(function (xs) {
        return function (ys) {
            return !Prelude["=="](eqList(__dict_Eq_9))(xs)(ys);
        };
    }, function (_661) {
        return function (_662) {
            if (_661 instanceof Nil && _662 instanceof Nil) {
                return true;
            };
            if (_661 instanceof Cons && _662 instanceof Cons) {
                return Prelude["=="](__dict_Eq_9)(_661.value0)(_662.value0) && Prelude["=="](eqList(__dict_Eq_9))(_661.value1)(_662.value1);
            };
            return false;
        };
    });
};
var ordList = function (__dict_Ord_3) {
    return new Prelude.Ord(function () {
        return eqList(__dict_Ord_3["__superclass_Prelude.Eq_0"]());
    }, function (_663) {
        return function (_664) {
            if (_663 instanceof Nil && _664 instanceof Nil) {
                return Prelude.EQ.value;
            };
            if (_663 instanceof Nil) {
                return Prelude.LT.value;
            };
            if (_664 instanceof Nil) {
                return Prelude.GT.value;
            };
            if (_663 instanceof Cons && _664 instanceof Cons) {
                var _2873 = Prelude.compare(__dict_Ord_3)(_663.value0)(_664.value0);
                if (_2873 instanceof Prelude.EQ) {
                    return Prelude.compare(ordList(__dict_Ord_3))(_663.value1)(_664.value1);
                };
                return _2873;
            };
            throw new Error("Failed pattern match");
        };
    });
};
var drop = function (__copy__632) {
    return function (__copy__633) {
        var _632 = __copy__632;
        var _633 = __copy__633;
        tco: while (true) {
            if (_632 === 0) {
                return _633;
            };
            if (_633 instanceof Nil) {
                return Nil.value;
            };
            if (_633 instanceof Cons) {
                var __tco__632 = _632 - 1;
                var __tco__633 = _633.value1;
                _632 = __tco__632;
                _633 = __tco__633;
                continue tco;
            };
            throw new Error("Failed pattern match");
        };
    };
};
var deleteBy = function ($eq$eq) {
    return function (x) {
        return function (_652) {
            if (_652 instanceof Nil) {
                return Nil.value;
            };
            if (_652 instanceof Cons && $eq$eq(x)(_652.value0)) {
                return _652.value1;
            };
            if (_652 instanceof Cons) {
                return new Cons(_652.value0, deleteBy($eq$eq)(x)(_652.value1));
            };
            throw new Error("Failed pattern match");
        };
    };
};
var unionBy = function (eq) {
    return function (xs) {
        return function (ys) {
            return Prelude["<>"](semigroupList)(xs)(Data_Foldable.foldl(foldableList)(Prelude.flip(deleteBy(eq)))(nubBy(eq)(ys))(xs));
        };
    };
};
var union = function (__dict_Eq_10) {
    return unionBy(Prelude["=="](__dict_Eq_10));
};
var deleteAt = function (_653) {
    return function (_654) {
        if (_653 === 0 && _654 instanceof Cons) {
            return new Data_Maybe.Just(_654.value1);
        };
        if (_654 instanceof Cons) {
            return Prelude["<$>"](Data_Maybe.functorMaybe)(Cons.create(_654.value0))(deleteAt(_653 - 1)(_654.value1));
        };
        return Data_Maybe.Nothing.value;
    };
};
var $$delete = function (__dict_Eq_11) {
    return deleteBy(Prelude["=="](__dict_Eq_11));
};
var $bslash$bslash = function (__dict_Eq_12) {
    return Data_Foldable.foldl(foldableList)(Prelude.flip($$delete(__dict_Eq_12)));
};
var catMaybes = mapMaybe(Prelude.id(Prelude.categoryArr));
var applyList = new Prelude.Apply(function (_673) {
    return function (xs) {
        if (_673 instanceof Nil) {
            return Nil.value;
        };
        if (_673 instanceof Cons) {
            return Prelude["<>"](semigroupList)(Prelude["<$>"](functorList)(_673.value0)(xs))(Prelude["<*>"](applyList)(_673.value1)(xs));
        };
        throw new Error("Failed pattern match");
    };
}, function () {
    return functorList;
});
var bindList = new Prelude.Bind(function (_674) {
    return function (f) {
        if (_674 instanceof Nil) {
            return Nil.value;
        };
        if (_674 instanceof Cons) {
            return Prelude["<>"](semigroupList)(f(_674.value0))(Prelude[">>="](bindList)(_674.value1)(f));
        };
        throw new Error("Failed pattern match");
    };
}, function () {
    return applyList;
});
var applicativeList = new Prelude.Applicative(function () {
    return applyList;
}, function (a) {
    return new Cons(a, Nil.value);
});
var monadList = new Prelude.Monad(function () {
    return applicativeList;
}, function () {
    return bindList;
});
var alterAt = function (_655) {
    return function (f) {
        return function (_656) {
            if (_655 === 0 && _656 instanceof Cons) {
                return Data_Maybe.Just.create((function () {
                    var _2906 = f(_656.value0);
                    if (_2906 instanceof Data_Maybe.Nothing) {
                        return _656.value1;
                    };
                    if (_2906 instanceof Data_Maybe.Just) {
                        return new Cons(_2906.value0, _656.value1);
                    };
                    throw new Error("Failed pattern match");
                })());
            };
            if (_656 instanceof Cons) {
                return Prelude["<$>"](Data_Maybe.functorMaybe)(Cons.create(_656.value0))(alterAt(_655 - 1)(f)(_656.value1));
            };
            return Data_Maybe.Nothing.value;
        };
    };
};
var altList = new Control_Alt.Alt(Prelude["<>"](semigroupList), function () {
    return functorList;
});
var plusList = new Control_Plus.Plus(function () {
    return altList;
}, Nil.value);
var alternativeList = new Control_Alternative.Alternative(function () {
    return plusList;
}, function () {
    return applicativeList;
});
var monadPlusList = new Control_MonadPlus.MonadPlus(function () {
    return alternativeList;
}, function () {
    return monadList;
});
module.exports = {
    Nil: Nil, 
    Cons: Cons, 
    unionBy: unionBy, 
    union: union, 
    uncons: uncons, 
    intersectBy: intersectBy, 
    intersect: intersect, 
    nubBy: nubBy, 
    nub: nub, 
    reverse: reverse, 
    alterAt: alterAt, 
    deleteAt: deleteAt, 
    deleteBy: deleteBy, 
    "delete": $$delete, 
    insertAt: insertAt, 
    insertBy: insertBy, 
    insert: insert, 
    "\\\\": $bslash$bslash, 
    groupBy: groupBy, 
    group: group, 
    span: span, 
    "null": $$null, 
    zipWith: zipWith, 
    init: init, 
    last: last, 
    tail: tail, 
    head: head, 
    catMaybes: catMaybes, 
    mapMaybe: mapMaybe, 
    filter: filter, 
    length: length, 
    take: take, 
    drop: drop, 
    "!": $bang, 
    toArray: toArray, 
    fromArray: fromArray, 
    showList: showList, 
    eqList: eqList, 
    ordList: ordList, 
    semigroupList: semigroupList, 
    monoidList: monoidList, 
    functorList: functorList, 
    foldableList: foldableList, 
    unfoldableList: unfoldableList, 
    traversableList: traversableList, 
    applyList: applyList, 
    applicativeList: applicativeList, 
    bindList: bindList, 
    monadList: monadList, 
    altList: altList, 
    plusList: plusList, 
    alternativeList: alternativeList, 
    monadPlusList: monadPlusList
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.MonadPlus":57,"Control.Plus":58,"Data.Foldable":76,"Data.Maybe":89,"Data.Monoid":96,"Data.Traversable":107,"Data.Tuple":108,"Data.Unfoldable":109,"Prelude":130}],89:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Alt = require("Control.Alt");
var Control_Alternative = require("Control.Alternative");
var Control_Extend = require("Control.Extend");
var Control_MonadPlus = require("Control.MonadPlus");
var Control_Plus = require("Control.Plus");
var Nothing = (function () {
    function Nothing() {

    };
    Nothing.value = new Nothing();
    return Nothing;
})();
var Just = (function () {
    function Just(value0) {
        this.value0 = value0;
    };
    Just.create = function (value0) {
        return new Just(value0);
    };
    return Just;
})();
var showMaybe = function (__dict_Show_0) {
    return new Prelude.Show(function (_145) {
        if (_145 instanceof Just) {
            return "Just (" + (Prelude.show(__dict_Show_0)(_145.value0) + ")");
        };
        if (_145 instanceof Nothing) {
            return "Nothing";
        };
        throw new Error("Failed pattern match");
    });
};
var semigroupMaybe = function (__dict_Semigroup_1) {
    return new Prelude.Semigroup(function (_143) {
        return function (_144) {
            if (_143 instanceof Nothing) {
                return _144;
            };
            if (_144 instanceof Nothing) {
                return _143;
            };
            if (_143 instanceof Just && _144 instanceof Just) {
                return new Just(Prelude["<>"](__dict_Semigroup_1)(_143.value0)(_144.value0));
            };
            throw new Error("Failed pattern match");
        };
    });
};
var maybe = function (b) {
    return function (f) {
        return function (_137) {
            if (_137 instanceof Nothing) {
                return b;
            };
            if (_137 instanceof Just) {
                return f(_137.value0);
            };
            throw new Error("Failed pattern match");
        };
    };
};
var isNothing = maybe(true)(Prelude["const"](false));
var isJust = maybe(false)(Prelude["const"](true));
var functorMaybe = new Prelude.Functor(function (fn) {
    return function (_138) {
        if (_138 instanceof Just) {
            return new Just(fn(_138.value0));
        };
        return Nothing.value;
    };
});
var fromMaybe = function (a) {
    return maybe(a)(Prelude.id(Prelude.categoryArr));
};
var extendMaybe = new Control_Extend.Extend(function (f) {
    return function (_142) {
        if (_142 instanceof Nothing) {
            return Nothing.value;
        };
        return new Just(f(_142));
    };
}, function () {
    return functorMaybe;
});
var eqMaybe = function (__dict_Eq_3) {
    return new Prelude.Eq(function (a) {
        return function (b) {
            return !Prelude["=="](eqMaybe(__dict_Eq_3))(a)(b);
        };
    }, function (_146) {
        return function (_147) {
            if (_146 instanceof Nothing && _147 instanceof Nothing) {
                return true;
            };
            if (_146 instanceof Just && _147 instanceof Just) {
                return Prelude["=="](__dict_Eq_3)(_146.value0)(_147.value0);
            };
            return false;
        };
    });
};
var ordMaybe = function (__dict_Ord_2) {
    return new Prelude.Ord(function () {
        return eqMaybe(__dict_Ord_2["__superclass_Prelude.Eq_0"]());
    }, function (_148) {
        return function (_149) {
            if (_148 instanceof Just && _149 instanceof Just) {
                return Prelude.compare(__dict_Ord_2)(_148.value0)(_149.value0);
            };
            if (_148 instanceof Nothing && _149 instanceof Nothing) {
                return Prelude.EQ.value;
            };
            if (_148 instanceof Nothing) {
                return Prelude.LT.value;
            };
            if (_149 instanceof Nothing) {
                return Prelude.GT.value;
            };
            throw new Error("Failed pattern match");
        };
    });
};
var applyMaybe = new Prelude.Apply(function (_139) {
    return function (x) {
        if (_139 instanceof Just) {
            return Prelude["<$>"](functorMaybe)(_139.value0)(x);
        };
        if (_139 instanceof Nothing) {
            return Nothing.value;
        };
        throw new Error("Failed pattern match");
    };
}, function () {
    return functorMaybe;
});
var bindMaybe = new Prelude.Bind(function (_141) {
    return function (k) {
        if (_141 instanceof Just) {
            return k(_141.value0);
        };
        if (_141 instanceof Nothing) {
            return Nothing.value;
        };
        throw new Error("Failed pattern match");
    };
}, function () {
    return applyMaybe;
});
var applicativeMaybe = new Prelude.Applicative(function () {
    return applyMaybe;
}, Just.create);
var monadMaybe = new Prelude.Monad(function () {
    return applicativeMaybe;
}, function () {
    return bindMaybe;
});
var altMaybe = new Control_Alt.Alt(function (_140) {
    return function (r) {
        if (_140 instanceof Nothing) {
            return r;
        };
        return _140;
    };
}, function () {
    return functorMaybe;
});
var plusMaybe = new Control_Plus.Plus(function () {
    return altMaybe;
}, Nothing.value);
var alternativeMaybe = new Control_Alternative.Alternative(function () {
    return plusMaybe;
}, function () {
    return applicativeMaybe;
});
var monadPlusMaybe = new Control_MonadPlus.MonadPlus(function () {
    return alternativeMaybe;
}, function () {
    return monadMaybe;
});
module.exports = {
    Nothing: Nothing, 
    Just: Just, 
    isNothing: isNothing, 
    isJust: isJust, 
    fromMaybe: fromMaybe, 
    maybe: maybe, 
    functorMaybe: functorMaybe, 
    applyMaybe: applyMaybe, 
    applicativeMaybe: applicativeMaybe, 
    altMaybe: altMaybe, 
    plusMaybe: plusMaybe, 
    alternativeMaybe: alternativeMaybe, 
    bindMaybe: bindMaybe, 
    monadMaybe: monadMaybe, 
    monadPlusMaybe: monadPlusMaybe, 
    extendMaybe: extendMaybe, 
    semigroupMaybe: semigroupMaybe, 
    showMaybe: showMaybe, 
    eqMaybe: eqMaybe, 
    ordMaybe: ordMaybe
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Extend":31,"Control.MonadPlus":57,"Control.Plus":58,"Prelude":130}],90:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Comonad = require("Control.Comonad");
var Control_Extend = require("Control.Extend");
var Data_Monoid = require("Data.Monoid");
var Additive = function (x) {
    return x;
};
var showAdditive = function (__dict_Show_0) {
    return new Prelude.Show(function (_198) {
        return "Additive (" + (Prelude.show(__dict_Show_0)(_198) + ")");
    });
};
var semigroupAdditive = function (__dict_Semiring_1) {
    return new Prelude.Semigroup(function (_199) {
        return function (_200) {
            return Prelude["+"](__dict_Semiring_1)(_199)(_200);
        };
    });
};
var runAdditive = function (_187) {
    return _187;
};
var monoidAdditive = function (__dict_Semiring_3) {
    return new Data_Monoid.Monoid(function () {
        return semigroupAdditive(__dict_Semiring_3);
    }, Prelude.zero(__dict_Semiring_3));
};
var functorAdditive = new Prelude.Functor(function (f) {
    return function (_194) {
        return f(_194);
    };
});
var extendAdditive = new Control_Extend.Extend(function (f) {
    return function (x) {
        return f(x);
    };
}, function () {
    return functorAdditive;
});
var eqAdditive = function (__dict_Eq_4) {
    return new Prelude.Eq(function (_190) {
        return function (_191) {
            return Prelude["/="](__dict_Eq_4)(_190)(_191);
        };
    }, function (_188) {
        return function (_189) {
            return Prelude["=="](__dict_Eq_4)(_188)(_189);
        };
    });
};
var ordAdditive = function (__dict_Ord_2) {
    return new Prelude.Ord(function () {
        return eqAdditive(__dict_Ord_2["__superclass_Prelude.Eq_0"]());
    }, function (_192) {
        return function (_193) {
            return Prelude.compare(__dict_Ord_2)(_192)(_193);
        };
    });
};
var comonadAdditive = new Control_Comonad.Comonad(function () {
    return extendAdditive;
}, runAdditive);
var applyAdditive = new Prelude.Apply(function (_195) {
    return function (_196) {
        return _195(_196);
    };
}, function () {
    return functorAdditive;
});
var bindAdditive = new Prelude.Bind(function (_197) {
    return function (f) {
        return f(_197);
    };
}, function () {
    return applyAdditive;
});
var applicativeAdditive = new Prelude.Applicative(function () {
    return applyAdditive;
}, Additive);
var monadAdditive = new Prelude.Monad(function () {
    return applicativeAdditive;
}, function () {
    return bindAdditive;
});
module.exports = {
    Additive: Additive, 
    runAdditive: runAdditive, 
    eqAdditive: eqAdditive, 
    ordAdditive: ordAdditive, 
    functorAdditive: functorAdditive, 
    applyAdditive: applyAdditive, 
    applicativeAdditive: applicativeAdditive, 
    bindAdditive: bindAdditive, 
    monadAdditive: monadAdditive, 
    extendAdditive: extendAdditive, 
    comonadAdditive: comonadAdditive, 
    showAdditive: showAdditive, 
    semigroupAdditive: semigroupAdditive, 
    monoidAdditive: monoidAdditive
};

},{"Control.Comonad":30,"Control.Extend":31,"Data.Monoid":96,"Prelude":130}],91:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Monoid = require("Data.Monoid");
var All = function (x) {
    return x;
};
var showAll = new Prelude.Show(function (_208) {
    return "All (" + (Prelude.show(Prelude.showBoolean)(_208) + ")");
});
var semigroupAll = new Prelude.Semigroup(function (_209) {
    return function (_210) {
        return _209 && _210;
    };
});
var runAll = function (_201) {
    return _201;
};
var monoidAll = new Data_Monoid.Monoid(function () {
    return semigroupAll;
}, true);
var eqAll = new Prelude.Eq(function (_204) {
    return function (_205) {
        return _204 !== _205;
    };
}, function (_202) {
    return function (_203) {
        return _202 === _203;
    };
});
var ordAll = new Prelude.Ord(function () {
    return eqAll;
}, function (_206) {
    return function (_207) {
        return Prelude.compare(Prelude.ordBoolean)(_206)(_207);
    };
});
module.exports = {
    All: All, 
    runAll: runAll, 
    eqAll: eqAll, 
    ordAll: ordAll, 
    showAll: showAll, 
    semigroupAll: semigroupAll, 
    monoidAll: monoidAll
};

},{"Data.Monoid":96,"Prelude":130}],92:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Monoid = require("Data.Monoid");
var Control_Comonad = require("Control.Comonad");
var Control_Extend = require("Control.Extend");
var Dual = function (x) {
    return x;
};
var showDual = function (__dict_Show_0) {
    return new Prelude.Show(function (_232) {
        return "Dual (" + (Prelude.show(__dict_Show_0)(_232) + ")");
    });
};
var semigroupDual = function (__dict_Semigroup_1) {
    return new Prelude.Semigroup(function (_233) {
        return function (_234) {
            return Prelude["<>"](__dict_Semigroup_1)(_234)(_233);
        };
    });
};
var runDual = function (_221) {
    return _221;
};
var monoidDual = function (__dict_Monoid_3) {
    return new Data_Monoid.Monoid(function () {
        return semigroupDual(__dict_Monoid_3["__superclass_Prelude.Semigroup_0"]());
    }, Data_Monoid.mempty(__dict_Monoid_3));
};
var functorDual = new Prelude.Functor(function (f) {
    return function (_228) {
        return f(_228);
    };
});
var extendDual = new Control_Extend.Extend(function (f) {
    return function (x) {
        return f(x);
    };
}, function () {
    return functorDual;
});
var eqDual = function (__dict_Eq_4) {
    return new Prelude.Eq(function (_224) {
        return function (_225) {
            return Prelude["/="](__dict_Eq_4)(_224)(_225);
        };
    }, function (_222) {
        return function (_223) {
            return Prelude["=="](__dict_Eq_4)(_222)(_223);
        };
    });
};
var ordDual = function (__dict_Ord_2) {
    return new Prelude.Ord(function () {
        return eqDual(__dict_Ord_2["__superclass_Prelude.Eq_0"]());
    }, function (_226) {
        return function (_227) {
            return Prelude.compare(__dict_Ord_2)(_226)(_227);
        };
    });
};
var comonadDual = new Control_Comonad.Comonad(function () {
    return extendDual;
}, runDual);
var applyDual = new Prelude.Apply(function (_229) {
    return function (_230) {
        return _229(_230);
    };
}, function () {
    return functorDual;
});
var bindDual = new Prelude.Bind(function (_231) {
    return function (f) {
        return f(_231);
    };
}, function () {
    return applyDual;
});
var applicativeDual = new Prelude.Applicative(function () {
    return applyDual;
}, Dual);
var monadDual = new Prelude.Monad(function () {
    return applicativeDual;
}, function () {
    return bindDual;
});
module.exports = {
    Dual: Dual, 
    runDual: runDual, 
    eqDual: eqDual, 
    ordDual: ordDual, 
    functorDual: functorDual, 
    applyDual: applyDual, 
    applicativeDual: applicativeDual, 
    bindDual: bindDual, 
    monadDual: monadDual, 
    extendDual: extendDual, 
    comonadDual: comonadDual, 
    showDual: showDual, 
    semigroupDual: semigroupDual, 
    monoidDual: monoidDual
};

},{"Control.Comonad":30,"Control.Extend":31,"Data.Monoid":96,"Prelude":130}],93:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Extend = require("Control.Extend");
var Control_Comonad = require("Control.Comonad");
var Data_Maybe = require("Data.Maybe");
var Data_Monoid = require("Data.Monoid");
var First = function (x) {
    return x;
};
var showFirst = function (__dict_Show_0) {
    return new Prelude.Show(function (_356) {
        return "First (" + (Prelude.show(Data_Maybe.showMaybe(__dict_Show_0))(_356) + ")");
    });
};
var semigroupFirst = new Prelude.Semigroup(function (_357) {
    return function (second) {
        if (_357 instanceof Data_Maybe.Just) {
            return _357;
        };
        return second;
    };
});
var runFirst = function (_345) {
    return _345;
};
var monoidFirst = new Data_Monoid.Monoid(function () {
    return semigroupFirst;
}, Data_Maybe.Nothing.value);
var functorFirst = new Prelude.Functor(function (f) {
    return function (_352) {
        return Prelude["<$>"](Data_Maybe.functorMaybe)(f)(_352);
    };
});
var extendFirst = new Control_Extend.Extend(function (f) {
    return function (x) {
        return Control_Extend["<<="](extendFirst)(f)(x);
    };
}, function () {
    return functorFirst;
});
var eqFirst = function (__dict_Eq_2) {
    return new Prelude.Eq(function (_348) {
        return function (_349) {
            return Prelude["/="](Data_Maybe.eqMaybe(__dict_Eq_2))(_348)(_349);
        };
    }, function (_346) {
        return function (_347) {
            return Prelude["=="](Data_Maybe.eqMaybe(__dict_Eq_2))(_346)(_347);
        };
    });
};
var ordFirst = function (__dict_Ord_1) {
    return new Prelude.Ord(function () {
        return eqFirst(__dict_Ord_1["__superclass_Prelude.Eq_0"]());
    }, function (_350) {
        return function (_351) {
            return Prelude.compare(Data_Maybe.ordMaybe(__dict_Ord_1))(_350)(_351);
        };
    });
};
var applyFirst = new Prelude.Apply(function (_353) {
    return function (_354) {
        return Prelude["<*>"](Data_Maybe.applyMaybe)(_353)(_354);
    };
}, function () {
    return functorFirst;
});
var bindFirst = new Prelude.Bind(function (_355) {
    return function (f) {
        return Prelude[">>="](Data_Maybe.bindMaybe)(_355)(Prelude["<<<"](Prelude.semigroupoidArr)(runFirst)(f));
    };
}, function () {
    return applyFirst;
});
var applicativeFirst = new Prelude.Applicative(function () {
    return applyFirst;
}, Prelude["<<<"](Prelude.semigroupoidArr)(First)(Prelude.pure(Data_Maybe.applicativeMaybe)));
var monadFirst = new Prelude.Monad(function () {
    return applicativeFirst;
}, function () {
    return bindFirst;
});
module.exports = {
    First: First, 
    runFirst: runFirst, 
    eqFirst: eqFirst, 
    ordFirst: ordFirst, 
    functorFirst: functorFirst, 
    applyFirst: applyFirst, 
    applicativeFirst: applicativeFirst, 
    bindFirst: bindFirst, 
    monadFirst: monadFirst, 
    extendFirst: extendFirst, 
    showFirst: showFirst, 
    semigroupFirst: semigroupFirst, 
    monoidFirst: monoidFirst
};

},{"Control.Comonad":30,"Control.Extend":31,"Data.Maybe":89,"Data.Monoid":96,"Prelude":130}],94:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Extend = require("Control.Extend");
var Control_Comonad = require("Control.Comonad");
var Data_Maybe = require("Data.Maybe");
var Data_Monoid = require("Data.Monoid");
var Last = function (x) {
    return x;
};
var showLast = function (__dict_Show_0) {
    return new Prelude.Show(function (_369) {
        return "Last (" + (Prelude.show(Data_Maybe.showMaybe(__dict_Show_0))(_369) + ")");
    });
};
var semigroupLast = new Prelude.Semigroup(function (last) {
    return function (_370) {
        if (_370 instanceof Data_Maybe.Just) {
            return _370;
        };
        if (_370 instanceof Data_Maybe.Nothing) {
            return last;
        };
        throw new Error("Failed pattern match");
    };
});
var runLast = function (_358) {
    return _358;
};
var monoidLast = new Data_Monoid.Monoid(function () {
    return semigroupLast;
}, Data_Maybe.Nothing.value);
var functorLast = new Prelude.Functor(function (f) {
    return function (_365) {
        return Prelude["<$>"](Data_Maybe.functorMaybe)(f)(_365);
    };
});
var extendLast = new Control_Extend.Extend(function (f) {
    return function (x) {
        return Control_Extend["<<="](extendLast)(f)(x);
    };
}, function () {
    return functorLast;
});
var eqLast = function (__dict_Eq_2) {
    return new Prelude.Eq(function (_361) {
        return function (_362) {
            return Prelude["/="](Data_Maybe.eqMaybe(__dict_Eq_2))(_361)(_362);
        };
    }, function (_359) {
        return function (_360) {
            return Prelude["=="](Data_Maybe.eqMaybe(__dict_Eq_2))(_359)(_360);
        };
    });
};
var ordLast = function (__dict_Ord_1) {
    return new Prelude.Ord(function () {
        return eqLast(__dict_Ord_1["__superclass_Prelude.Eq_0"]());
    }, function (_363) {
        return function (_364) {
            return Prelude.compare(Data_Maybe.ordMaybe(__dict_Ord_1))(_363)(_364);
        };
    });
};
var applyLast = new Prelude.Apply(function (_366) {
    return function (_367) {
        return Prelude["<*>"](Data_Maybe.applyMaybe)(_366)(_367);
    };
}, function () {
    return functorLast;
});
var bindLast = new Prelude.Bind(function (_368) {
    return function (f) {
        return Prelude[">>="](Data_Maybe.bindMaybe)(_368)(Prelude["<<<"](Prelude.semigroupoidArr)(runLast)(f));
    };
}, function () {
    return applyLast;
});
var applicativeLast = new Prelude.Applicative(function () {
    return applyLast;
}, Prelude["<<<"](Prelude.semigroupoidArr)(Last)(Prelude.pure(Data_Maybe.applicativeMaybe)));
var monadLast = new Prelude.Monad(function () {
    return applicativeLast;
}, function () {
    return bindLast;
});
module.exports = {
    Last: Last, 
    runLast: runLast, 
    eqLast: eqLast, 
    ordLast: ordLast, 
    functorLast: functorLast, 
    applyLast: applyLast, 
    applicativeLast: applicativeLast, 
    bindLast: bindLast, 
    monadLast: monadLast, 
    extendLast: extendLast, 
    showLast: showLast, 
    semigroupLast: semigroupLast, 
    monoidLast: monoidLast
};

},{"Control.Comonad":30,"Control.Extend":31,"Data.Maybe":89,"Data.Monoid":96,"Prelude":130}],95:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Comonad = require("Control.Comonad");
var Control_Extend = require("Control.Extend");
var Data_Monoid = require("Data.Monoid");
var Multiplicative = function (x) {
    return x;
};
var showMultiplicative = function (__dict_Show_0) {
    return new Prelude.Show(function (_249) {
        return "Multiplicative (" + (Prelude.show(__dict_Show_0)(_249) + ")");
    });
};
var semigroupMultiplicative = function (__dict_Semiring_1) {
    return new Prelude.Semigroup(function (_250) {
        return function (_251) {
            return Prelude["*"](__dict_Semiring_1)(_250)(_251);
        };
    });
};
var runMultiplicative = function (_238) {
    return _238;
};
var monoidMultiplicative = function (__dict_Semiring_3) {
    return new Data_Monoid.Monoid(function () {
        return semigroupMultiplicative(__dict_Semiring_3);
    }, Prelude.one(__dict_Semiring_3));
};
var functorMultiplicative = new Prelude.Functor(function (f) {
    return function (_245) {
        return f(_245);
    };
});
var extendAdditive = new Control_Extend.Extend(function (f) {
    return function (x) {
        return f(x);
    };
}, function () {
    return functorMultiplicative;
});
var eqMultiplicative = function (__dict_Eq_4) {
    return new Prelude.Eq(function (_241) {
        return function (_242) {
            return Prelude["/="](__dict_Eq_4)(_241)(_242);
        };
    }, function (_239) {
        return function (_240) {
            return Prelude["=="](__dict_Eq_4)(_239)(_240);
        };
    });
};
var ordMultiplicative = function (__dict_Ord_2) {
    return new Prelude.Ord(function () {
        return eqMultiplicative(__dict_Ord_2["__superclass_Prelude.Eq_0"]());
    }, function (_243) {
        return function (_244) {
            return Prelude.compare(__dict_Ord_2)(_243)(_244);
        };
    });
};
var comonadAdditive = new Control_Comonad.Comonad(function () {
    return extendAdditive;
}, runMultiplicative);
var applyMultiplicative = new Prelude.Apply(function (_246) {
    return function (_247) {
        return _246(_247);
    };
}, function () {
    return functorMultiplicative;
});
var bindMultiplicative = new Prelude.Bind(function (_248) {
    return function (f) {
        return f(_248);
    };
}, function () {
    return applyMultiplicative;
});
var applicativeMultiplicative = new Prelude.Applicative(function () {
    return applyMultiplicative;
}, Multiplicative);
var monadMultiplicative = new Prelude.Monad(function () {
    return applicativeMultiplicative;
}, function () {
    return bindMultiplicative;
});
module.exports = {
    Multiplicative: Multiplicative, 
    runMultiplicative: runMultiplicative, 
    eqMultiplicative: eqMultiplicative, 
    ordMultiplicative: ordMultiplicative, 
    functorMultiplicative: functorMultiplicative, 
    applyMultiplicative: applyMultiplicative, 
    applicativeMultiplicative: applicativeMultiplicative, 
    bindMultiplicative: bindMultiplicative, 
    monadMultiplicative: monadMultiplicative, 
    extendAdditive: extendAdditive, 
    comonadAdditive: comonadAdditive, 
    showMultiplicative: showMultiplicative, 
    semigroupMultiplicative: semigroupMultiplicative, 
    monoidMultiplicative: monoidMultiplicative
};

},{"Control.Comonad":30,"Control.Extend":31,"Data.Monoid":96,"Prelude":130}],96:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Array = require("Data.Array");
var Data_Maybe = require("Data.Maybe");
var Monoid = function (__superclass_Prelude$dotSemigroup_0, mempty) {
    this["__superclass_Prelude.Semigroup_0"] = __superclass_Prelude$dotSemigroup_0;
    this.mempty = mempty;
};
var monoidUnit = new Monoid(function () {
    return Prelude.semigroupUnit;
}, Prelude.unit);
var monoidString = new Monoid(function () {
    return Prelude.semigroupString;
}, "");
var monoidMaybe = function (__dict_Semigroup_0) {
    return new Monoid(function () {
        return Data_Maybe.semigroupMaybe(__dict_Semigroup_0);
    }, Data_Maybe.Nothing.value);
};
var monoidArray = new Monoid(function () {
    return Data_Array.semigroupArray;
}, [  ]);
var mempty = function (dict) {
    return dict.mempty;
};
var monoidArr = function (__dict_Monoid_1) {
    return new Monoid(function () {
        return Prelude.semigroupArr(__dict_Monoid_1["__superclass_Prelude.Semigroup_0"]());
    }, Prelude["const"](mempty(__dict_Monoid_1)));
};
module.exports = {
    Monoid: Monoid, 
    mempty: mempty, 
    monoidString: monoidString, 
    monoidArray: monoidArray, 
    monoidUnit: monoidUnit, 
    monoidArr: monoidArr, 
    monoidMaybe: monoidMaybe
};

},{"Data.Array":61,"Data.Maybe":89,"Prelude":130}],97:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Maybe = require("Data.Maybe");
var Data_Function = require("Data.Function");
var Prelude = require("Prelude");
var $$null = null;
function nullable(a, r, f) {  return a === null || typeof a === 'undefined' ? r : f(a);};
function notNull(x) {  return x;};
var toNullable = Data_Maybe.maybe($$null)(notNull);
var toMaybe = function (n) {
    return nullable(n, Data_Maybe.Nothing.value, Data_Maybe.Just.create);
};
var showNullable = function (__dict_Show_0) {
    return new Prelude.Show(function (n) {
        var _1666 = toMaybe(n);
        if (_1666 instanceof Data_Maybe.Nothing) {
            return "null";
        };
        if (_1666 instanceof Data_Maybe.Just) {
            return Prelude.show(__dict_Show_0)(_1666.value0);
        };
        throw new Error("Failed pattern match");
    });
};
var eqNullable = function (__dict_Eq_2) {
    return new Prelude.Eq(Data_Function.on(Prelude["/="](Data_Maybe.eqMaybe(__dict_Eq_2)))(toMaybe), Data_Function.on(Prelude["=="](Data_Maybe.eqMaybe(__dict_Eq_2)))(toMaybe));
};
var ordNullable = function (__dict_Ord_1) {
    return new Prelude.Ord(function () {
        return eqNullable(__dict_Ord_1["__superclass_Prelude.Eq_0"]());
    }, Data_Function.on(Prelude.compare(Data_Maybe.ordMaybe(__dict_Ord_1)))(toMaybe));
};
module.exports = {
    toNullable: toNullable, 
    toMaybe: toMaybe, 
    showNullable: showNullable, 
    eqNullable: eqNullable, 
    ordNullable: ordNullable
};

},{"Data.Function":83,"Data.Maybe":89,"Prelude":130}],98:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Profunctor = require("Data.Profunctor");
var Data_Either = require("Data.Either");
var Choice = function (__superclass_Data$dotProfunctor$dotProfunctor_0, left, right) {
    this["__superclass_Data.Profunctor.Profunctor_0"] = __superclass_Data$dotProfunctor$dotProfunctor_0;
    this.left = left;
    this.right = right;
};
var right = function (dict) {
    return dict.right;
};
var left = function (dict) {
    return dict.left;
};
var $plus$plus$plus = function (__dict_Category_0) {
    return function (__dict_Choice_1) {
        return function (l) {
            return function (r) {
                return Prelude[">>>"](__dict_Category_0["__superclass_Prelude.Semigroupoid_0"]())(left(__dict_Choice_1)(l))(right(__dict_Choice_1)(r));
            };
        };
    };
};
var $bar$bar$bar = function (__dict_Category_2) {
    return function (__dict_Choice_3) {
        return function (l) {
            return function (r) {
                var join = Data_Profunctor.dimap(__dict_Choice_3["__superclass_Data.Profunctor.Profunctor_0"]())(Data_Either.either(Prelude.id(Prelude.categoryArr))(Prelude.id(Prelude.categoryArr)))(Prelude.id(Prelude.categoryArr))(Prelude.id(__dict_Category_2));
                return Prelude[">>>"](__dict_Category_2["__superclass_Prelude.Semigroupoid_0"]())($plus$plus$plus(__dict_Category_2)(__dict_Choice_3)(l)(r))(join);
            };
        };
    };
};
var choiceArr = new Choice(function () {
    return Data_Profunctor.profunctorArr;
}, function (a2b) {
    return function (_136) {
        if (_136 instanceof Data_Either.Left) {
            return Data_Either.Left.create(a2b(_136.value0));
        };
        if (_136 instanceof Data_Either.Right) {
            return new Data_Either.Right(_136.value0);
        };
        throw new Error("Failed pattern match");
    };
}, Prelude["<$>"](Data_Either.functorEither));
module.exports = {
    Choice: Choice, 
    "|||": $bar$bar$bar, 
    "+++": $plus$plus$plus, 
    right: right, 
    left: left, 
    choiceArr: choiceArr
};

},{"Data.Either":74,"Data.Profunctor":100,"Prelude":130}],99:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Profunctor = require("Data.Profunctor");
var Data_Tuple = require("Data.Tuple");
var Strong = function (__superclass_Data$dotProfunctor$dotProfunctor_0, first, second) {
    this["__superclass_Data.Profunctor.Profunctor_0"] = __superclass_Data$dotProfunctor$dotProfunctor_0;
    this.first = first;
    this.second = second;
};
var strongArr = new Strong(function () {
    return Data_Profunctor.profunctorArr;
}, function (a2b) {
    return function (_322) {
        return new Data_Tuple.Tuple(a2b(_322.value0), _322.value1);
    };
}, Prelude["<$>"](Data_Tuple.functorTuple));
var second = function (dict) {
    return dict.second;
};
var first = function (dict) {
    return dict.first;
};
var $times$times$times = function (__dict_Category_0) {
    return function (__dict_Strong_1) {
        return function (l) {
            return function (r) {
                return Prelude[">>>"](__dict_Category_0["__superclass_Prelude.Semigroupoid_0"]())(first(__dict_Strong_1)(l))(second(__dict_Strong_1)(r));
            };
        };
    };
};
var $amp$amp$amp = function (__dict_Category_2) {
    return function (__dict_Strong_3) {
        return function (l) {
            return function (r) {
                var split = Data_Profunctor.dimap(__dict_Strong_3["__superclass_Data.Profunctor.Profunctor_0"]())(Prelude.id(Prelude.categoryArr))(function (a) {
                    return new Data_Tuple.Tuple(a, a);
                })(Prelude.id(__dict_Category_2));
                return Prelude[">>>"](__dict_Category_2["__superclass_Prelude.Semigroupoid_0"]())(split)($times$times$times(__dict_Category_2)(__dict_Strong_3)(l)(r));
            };
        };
    };
};
module.exports = {
    Strong: Strong, 
    "&&&": $amp$amp$amp, 
    "***": $times$times$times, 
    second: second, 
    first: first, 
    strongArr: strongArr
};

},{"Data.Profunctor":100,"Data.Tuple":108,"Prelude":130}],100:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Profunctor = function (dimap) {
    this.dimap = dimap;
};
var profunctorArr = new Profunctor(function (a2b) {
    return function (c2d) {
        return function (b2c) {
            return Prelude[">>>"](Prelude.semigroupoidArr)(a2b)(Prelude[">>>"](Prelude.semigroupoidArr)(b2c)(c2d));
        };
    };
});
var dimap = function (dict) {
    return dict.dimap;
};
var lmap = function (__dict_Profunctor_0) {
    return function (a2b) {
        return dimap(__dict_Profunctor_0)(a2b)(Prelude.id(Prelude.categoryArr));
    };
};
var rmap = function (__dict_Profunctor_1) {
    return function (b2c) {
        return dimap(__dict_Profunctor_1)(Prelude.id(Prelude.categoryArr))(b2c);
    };
};
var arr = function (__dict_Category_2) {
    return function (__dict_Profunctor_3) {
        return function (f) {
            return rmap(__dict_Profunctor_3)(f)(Prelude.id(__dict_Category_2));
        };
    };
};
module.exports = {
    Profunctor: Profunctor, 
    arr: arr, 
    rmap: rmap, 
    lmap: lmap, 
    dimap: dimap, 
    profunctorArr: profunctorArr
};

},{"Prelude":130}],101:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Foldable = require("Data.Foldable");
var Prelude = require("Prelude");
var Data_Array = require("Data.Array");
var Data_Traversable = require("Data.Traversable");
var Data_Monoid = require("Data.Monoid");
var Free = function (x) {
    return x;
};
var showFree = function (__dict_Show_2) {
    return new Prelude.Show(function (_573) {
        return "(Free " + (Prelude.show(Prelude.showArray(Prelude.showArray(__dict_Show_2)))(_573) + ")");
    });
};
var semiringFree = new Prelude.Semiring(function (_582) {
    return function (_583) {
        return Prelude[">>="](Data_Array.bindArray)(_582)(function (_38) {
            return Prelude[">>="](Data_Array.bindArray)(_583)(function (_37) {
                return Prelude["return"](Data_Array.monadArray)(Prelude["<>"](Data_Array.semigroupArray)(_38)(_37));
            });
        });
    };
}, function (_580) {
    return function (_581) {
        return Prelude["<>"](Data_Array.semigroupArray)(_580)(_581);
    };
}, [ [  ] ], [  ]);
var runFree = function (_571) {
    return _571;
};
var liftFree = function (__dict_Semiring_4) {
    return function (f) {
        return function (_572) {
            var sum = Data_Foldable.foldl(Data_Foldable.foldableArray)(Prelude["+"](__dict_Semiring_4))(Prelude.zero(__dict_Semiring_4));
            var product = Data_Foldable.foldl(Data_Foldable.foldableArray)(Prelude["*"](__dict_Semiring_4))(Prelude.one(__dict_Semiring_4));
            return sum(Data_Array.map(Prelude["<<<"](Prelude.semigroupoidArr)(product)(Data_Array.map(f)))(_572));
        };
    };
};
var functorFree = new Prelude.Functor(function (fn) {
    return function (_584) {
        return Free(Prelude["<$>"](Data_Array.functorArray)(Prelude["<$>"](Data_Array.functorArray)(fn))(_584));
    };
});
var free = function (a) {
    return [ [ a ] ];
};
var lowerFree = function (__dict_Semiring_5) {
    return function (f) {
        return function (a) {
            return f(free(a));
        };
    };
};
var foldableFree = new Data_Foldable.Foldable(function (__dict_Monoid_6) {
    return function (fn) {
        return function (_589) {
            return Data_Foldable.fold(Data_Foldable.foldableArray)(__dict_Monoid_6)(Data_Foldable.foldMap(Data_Foldable.foldableArray)(Data_Monoid.monoidArray)(Prelude["<$>"](Data_Array.functorArray)(fn))(_589));
        };
    };
}, function (fn) {
    return function (accum) {
        return function (_587) {
            return Data_Foldable.foldl(Data_Foldable.foldableArray)(Data_Foldable.foldl(Data_Foldable.foldableArray)(fn))(accum)(_587);
        };
    };
}, function (fn) {
    return function (accum) {
        return function (_588) {
            return Data_Foldable.foldr(Data_Foldable.foldableArray)(Prelude.flip(Data_Foldable.foldr(Data_Foldable.foldableArray)(fn)))(accum)(_588);
        };
    };
});
var traversableFree = new Data_Traversable.Traversable(function () {
    return foldableFree;
}, function () {
    return functorFree;
}, function (__dict_Applicative_0) {
    return function (_590) {
        return Prelude["<$>"]((__dict_Applicative_0["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Free)(Data_Traversable.sequence(Data_Traversable.traversableArray)(__dict_Applicative_0)(Prelude["<$>"](Data_Array.functorArray)(Data_Traversable.sequence(Data_Traversable.traversableArray)(__dict_Applicative_0))(_590)));
    };
}, function (__dict_Applicative_1) {
    return function (fn) {
        return function (freeA) {
            return Data_Traversable.sequence(traversableFree)(__dict_Applicative_1)(Prelude["<$>"](functorFree)(fn)(freeA));
        };
    };
});
var eqFree = function (__dict_Eq_7) {
    return new Prelude.Eq(function (_576) {
        return function (_577) {
            return Prelude["/="](Prelude.eqArray(Prelude.eqArray(__dict_Eq_7)))(_576)(_577);
        };
    }, function (_574) {
        return function (_575) {
            return Prelude["=="](Prelude.eqArray(Prelude.eqArray(__dict_Eq_7)))(_574)(_575);
        };
    });
};
var ordFree = function (__dict_Ord_3) {
    return new Prelude.Ord(function () {
        return eqFree(__dict_Ord_3["__superclass_Prelude.Eq_0"]());
    }, function (_578) {
        return function (_579) {
            return Prelude.compare(Prelude.ordArray(Prelude.ordArray(__dict_Ord_3)))(_578)(_579);
        };
    });
};
var applyFree = new Prelude.Apply(function (_585) {
    return function (_586) {
        return Free(Prelude[">>="](Data_Array.bindArray)(_585)(function (_40) {
            return Prelude[">>="](Data_Array.bindArray)(_586)(function (_39) {
                return Prelude.pure(Data_Array.applicativeArray)(Prelude["<*>"](Data_Array.applyArray)(_40)(_39));
            });
        }));
    };
}, function () {
    return functorFree;
});
var applicativeFree = new Prelude.Applicative(function () {
    return applyFree;
}, free);
module.exports = {
    lowerFree: lowerFree, 
    liftFree: liftFree, 
    free: free, 
    runFree: runFree, 
    showFree: showFree, 
    eqFree: eqFree, 
    ordFree: ordFree, 
    semiringFree: semiringFree, 
    functorFree: functorFree, 
    applyFree: applyFree, 
    applicativeFree: applicativeFree, 
    foldableFree: foldableFree, 
    traversableFree: traversableFree
};

},{"Data.Array":61,"Data.Foldable":76,"Data.Monoid":96,"Data.Traversable":107,"Prelude":130}],102:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Control_Monad_ST = require("Control.Monad.ST");
var Data_Maybe = require("Data.Maybe");

  function _new() {
    return {};
  }
  ;

  function peek(m) {
    return function(k) {
      return function() {
        return m[k];
      }
    }
  }
  ;

  function poke(m) {
    return function(k) {
      return function(v) {
        return function() {
          m[k] = v;
          return m;
        };
      };
    };
  }
  ;

  function _delete(m) {
    return function(k) {
      return function() {
        delete m[k];
        return m;
      };
    };
  }
  ;
var $$new = _new;
var $$delete = _delete;
module.exports = {
    "delete": $$delete, 
    poke: poke, 
    peek: peek, 
    "new": $$new
};

},{"Control.Monad.Eff":40,"Control.Monad.ST":50,"Data.Maybe":89,"Prelude":130}],103:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Control_Monad_Eff = require("Control.Monad.Eff");
var Prelude = require("Prelude");
var Data_Function = require("Data.Function");
var Data_Monoid = require("Data.Monoid");
var Data_Foldable = require("Data.Foldable");
var Data_Tuple = require("Data.Tuple");
var Data_Traversable = require("Data.Traversable");
var Data_Maybe = require("Data.Maybe");
var Data_StrMap_ST = require("Data.StrMap.ST");
var Data_Monoid_All = require("Data.Monoid.All");
var Control_Monad_ST = require("Control.Monad.ST");
var Data_Array = require("Data.Array");

  function _copy(m) {
    var r = {};
    for (var k in m) {
      r[k] = m[k];
    }
    return r;
  }
  ;

  function _copyEff(m) {
    return function() {
      var r = {};
      for (var k in m) {
        r[k] = m[k];
      }
      return r;
    };
  }
  ;

  function runST(f) {
    return f;
  }
  ;

  function _fmapStrMap(m0, f) {
    var m = {};
    for (var k in m0) {
      m[k] = f(m0[k]);
    }
    return m;
  }
  ;

  function _foldM(bind) {
    return function(f) {
      return function(mz) {
        return function(m) {
          function g(k) {
            return function (z) {
              return f(z)(k)(m[k]);
            };
          }
          for (var k in m) {
            mz = bind(mz)(g(k));
          }
          return mz;
        };
      };
    };
  }
  ;

  function _foldSCStrMap(m, z, f, fromMaybe) {
    for (var k in m) {
      var maybeR = f(z)(k)(m[k]);
      var r = fromMaybe(null)(maybeR);
      if (r === null) return z;
      else z = r;
    }
    return z;
  }
  ;

  function all(f) {
    return function(m) {
      for (var k in m) {
        if (!f(k)(m[k])) return false;
      }
      return true;
    };
  }
  ;
var empty = {};;

  function size(m) {
    var s = 0;
    for (var k in m) {
      ++s;
    }
    return s;
  }
  ;

  function _lookup(no, yes, k, m) {
    return k in m ? yes(m[k]) : no;
  }
  ;

  function _unsafeDeleteStrMap(m, k) {
     delete m[k];
     return m;
  }
  ;

  function _lookupST(no, yes, k, m) {
    return function() {
      return k in m ? yes(m[k]) : no;
    }
  }
  ;

  function _collect(f) {
    return function(m) {
      var r = [];
      for (var k in m) {
        r.push(f(k)(m[k]));
      }
      return r;
    };
  }
  ;

  var keys = Object.keys || _collect(function(k) {
    return function() { return k; };
  });
  ;
var values = _collect(function (_596) {
    return function (v) {
        return v;
    };
});
var toList = _collect(Data_Tuple.Tuple.create);
var thawST = _copyEff;
var showStrMap = function (__dict_Show_0) {
    return new Prelude.Show(function (m) {
        return "fromList " + Prelude.show(Prelude.showArray(Data_Tuple.showTuple(Prelude.showString)(__dict_Show_0)))(toList(m));
    });
};
var pureST = function (f) {
    return Control_Monad_Eff.runPure(runST(f));
};
var singleton = function (k) {
    return function (v) {
        return pureST(function __do() {
            var _42 = Data_StrMap_ST["new"]();
            Data_StrMap_ST.poke(_42)(k)(v)();
            return _42;
        });
    };
};
var mutate = function (f) {
    return function (m) {
        return pureST(function __do() {
            var _41 = thawST(m)();
            f(_41)();
            return _41;
        });
    };
};
var member = Data_Function.runFn4(_lookup)(false)(Prelude["const"](true));
var lookup = Data_Function.runFn4(_lookup)(Data_Maybe.Nothing.value)(Data_Maybe.Just.create);
var isSubmap = function (__dict_Eq_2) {
    return function (m1) {
        return function (m2) {
            var f = function (k) {
                return function (v) {
                    return _lookup(false, Prelude["=="](__dict_Eq_2)(v), k, m2);
                };
            };
            return all(f)(m1);
        };
    };
};
var isEmpty = all(function (_593) {
    return function (_592) {
        return false;
    };
});
var insert = function (k) {
    return function (v) {
        return mutate(function (s) {
            return Data_StrMap_ST.poke(s)(k)(v);
        });
    };
};
var functorStrMap = new Prelude.Functor(function (f) {
    return function (m) {
        return _fmapStrMap(m, f);
    };
});
var map = Prelude["<$>"](functorStrMap);
var fromListWith = function (f) {
    return function (l) {
        return pureST(function __do() {
            var _44 = Data_StrMap_ST["new"]();
            Data_Foldable.for_(Control_Monad_Eff.applicativeEff)(Data_Foldable.foldableArray)(l)(function (_595) {
                return Prelude[">>="](Control_Monad_Eff.bindEff)(_lookupST(_595.value1, f(_595.value1), _595.value0, _44))(Data_StrMap_ST.poke(_44)(_595.value0));
            })();
            return _44;
        });
    };
};
var fromList = function (l) {
    return pureST(function __do() {
        var _43 = Data_StrMap_ST["new"]();
        Data_Foldable.for_(Control_Monad_Eff.applicativeEff)(Data_Foldable.foldableArray)(l)(function (_594) {
            return Data_StrMap_ST.poke(_43)(_594.value0)(_594.value1);
        })();
        return _43;
    });
};
var freezeST = _copyEff;
var foldMaybe = function (f) {
    return function (z) {
        return function (m) {
            return _foldSCStrMap(m, z, f, Data_Maybe.fromMaybe);
        };
    };
};
var foldM = function (__dict_Monad_3) {
    return function (f) {
        return function (z) {
            return _foldM(Prelude[">>="](__dict_Monad_3["__superclass_Prelude.Bind_1"]()))(f)(Prelude.pure(__dict_Monad_3["__superclass_Prelude.Applicative_0"]())(z));
        };
    };
};
var semigroupStrMap = function (__dict_Semigroup_4) {
    return new Prelude.Semigroup(function (m1) {
        return function (m2) {
            return mutate(function (s) {
                return foldM(Control_Monad_Eff.monadEff)(function (s_1) {
                    return function (k) {
                        return function (v2) {
                            return Data_StrMap_ST.poke(s_1)(k)(_lookup(v2, function (v1) {
                                return Prelude["<>"](__dict_Semigroup_4)(v1)(v2);
                            }, k, m2));
                        };
                    };
                })(s)(m1);
            })(m2);
        };
    });
};
var monoidStrMap = function (__dict_Semigroup_1) {
    return new Data_Monoid.Monoid(function () {
        return semigroupStrMap(__dict_Semigroup_1);
    }, empty);
};
var union = function (m) {
    return mutate(function (s) {
        return foldM(Control_Monad_Eff.monadEff)(Data_StrMap_ST.poke)(s)(m);
    });
};
var unions = Data_Foldable.foldl(Data_Foldable.foldableArray)(union)(empty);
var fold = _foldM(Prelude["#"]);
var foldMap = function (__dict_Monoid_7) {
    return function (f) {
        return fold(function (acc) {
            return function (k) {
                return function (v) {
                    return Prelude["<>"](__dict_Monoid_7["__superclass_Prelude.Semigroup_0"]())(acc)(f(k)(v));
                };
            };
        })(Data_Monoid.mempty(__dict_Monoid_7));
    };
};
var foldableStrMap = new Data_Foldable.Foldable(function (__dict_Monoid_8) {
    return function (f) {
        return foldMap(__dict_Monoid_8)(Prelude["const"](f));
    };
}, function (f) {
    return fold(function (z) {
        return function (_591) {
            return f(z);
        };
    });
}, function (f) {
    return function (z) {
        return function (m) {
            return Data_Foldable.foldr(Data_Foldable.foldableArray)(f)(z)(values(m));
        };
    };
});
var traversableStrMap = new Data_Traversable.Traversable(function () {
    return foldableStrMap;
}, function () {
    return functorStrMap;
}, function (__dict_Applicative_6) {
    return Data_Traversable.traverse(traversableStrMap)(__dict_Applicative_6)(Prelude.id(Prelude.categoryArr));
}, function (__dict_Applicative_5) {
    return function (f) {
        return function (ms) {
            return Data_Foldable.foldr(Data_Foldable.foldableArray)(function (x) {
                return function (acc) {
                    return Prelude["<*>"](__dict_Applicative_5["__superclass_Prelude.Apply_0"]())(Prelude["<$>"]((__dict_Applicative_5["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(union)(x))(acc);
                };
            })(Prelude.pure(__dict_Applicative_5)(empty))(Prelude["<$>"](Data_Array.functorArray)(Prelude["<$>"]((__dict_Applicative_5["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Tuple.uncurry(singleton)))(Prelude["<$>"](Data_Array.functorArray)(Data_Traversable.traverse(Data_Traversable.traversableTuple)(__dict_Applicative_5)(f))(toList(ms))));
        };
    };
});
var eqStrMap = function (__dict_Eq_9) {
    return new Prelude.Eq(function (m1) {
        return function (m2) {
            return !Prelude["=="](eqStrMap(__dict_Eq_9))(m1)(m2);
        };
    }, function (m1) {
        return function (m2) {
            return isSubmap(__dict_Eq_9)(m1)(m2) && isSubmap(__dict_Eq_9)(m2)(m1);
        };
    });
};
var $$delete = function (k) {
    return mutate(function (s) {
        return Data_StrMap_ST["delete"](s)(k);
    });
};
var alter = function (f) {
    return function (k) {
        return function (m) {
            var _2632 = f(lookup(k)(m));
            if (_2632 instanceof Data_Maybe.Nothing) {
                return $$delete(k)(m);
            };
            if (_2632 instanceof Data_Maybe.Just) {
                return insert(k)(_2632.value0)(m);
            };
            throw new Error("Failed pattern match");
        };
    };
};
var update = function (f) {
    return function (k) {
        return function (m) {
            return alter(Data_Maybe.maybe(Data_Maybe.Nothing.value)(f))(k)(m);
        };
    };
};
module.exports = {
    runST: runST, 
    freezeST: freezeST, 
    thawST: thawST, 
    all: all, 
    foldMaybe: foldMaybe, 
    foldM: foldM, 
    foldMap: foldMap, 
    fold: fold, 
    isSubmap: isSubmap, 
    map: map, 
    unions: unions, 
    union: union, 
    values: values, 
    keys: keys, 
    update: update, 
    alter: alter, 
    member: member, 
    "delete": $$delete, 
    fromListWith: fromListWith, 
    fromList: fromList, 
    toList: toList, 
    lookup: lookup, 
    insert: insert, 
    singleton: singleton, 
    size: size, 
    isEmpty: isEmpty, 
    empty: empty, 
    functorStrMap: functorStrMap, 
    foldableStrMap: foldableStrMap, 
    traversableStrMap: traversableStrMap, 
    eqStrMap: eqStrMap, 
    showStrMap: showStrMap, 
    semigroupStrMap: semigroupStrMap, 
    monoidStrMap: monoidStrMap
};

},{"Control.Monad.Eff":40,"Control.Monad.ST":50,"Data.Array":61,"Data.Foldable":76,"Data.Function":83,"Data.Maybe":89,"Data.Monoid":96,"Data.Monoid.All":91,"Data.StrMap.ST":102,"Data.Traversable":107,"Data.Tuple":108,"Prelude":130}],104:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_String = require("Data.String");
var Data_Function = require("Data.Function");
var Data_Maybe = require("Data.Maybe");

  function showRegex$prime(r) {
    return '' + r;
  }
  ;

  function regex$prime(s1) {
    return function(s2) {
      return new RegExp(s1, s2);
    };
  }
  ;

  function source(r) {
    return r.source;
  }
  ;

  function flags(r) {
    return {
      multiline: r.multiline,
      ignoreCase: r.ignoreCase,
      global: r.global,
      sticky: !!r.sticky,
      unicode: !!r.unicode
    };
  }
  ;

  function test(r) {
    return function(s) {
      return r.test(s);
    };
  }
  ;

  function _match(r, s, Just, Nothing) {
    var m = s.match(r);
    return m == null ? Nothing : Just(m);
  }
  ;

  function replace(r) {
    return function(s1) {
      return function(s2) {
        return s2.replace(r, s1);
      };
    };
  }
  ;

  function replace$prime(r) {
    return function(f) {
      return function(s2) {
        return s2.replace(r, function(match) {
          return f(match)(Array.prototype.splice.call(arguments, 1, arguments.length - 3));
        });
      };
    };
  }
  ;

  function search(r) {
    return function(s) {
      return s.search(r);
    };
  }
  ;

  function split(r) {
    return function(s) {
      return s.split(r);
    };
  }
  ;
var showRegex = new Prelude.Show(showRegex$prime);
var renderFlags = function (flags) {
    return (function () {
        if (flags.global) {
            return "g";
        };
        if (!flags.global) {
            return "";
        };
        throw new Error("Failed pattern match");
    })() + ((function () {
        if (flags.ignoreCase) {
            return "i";
        };
        if (!flags.ignoreCase) {
            return "";
        };
        throw new Error("Failed pattern match");
    })() + ((function () {
        if (flags.multiline) {
            return "m";
        };
        if (!flags.multiline) {
            return "";
        };
        throw new Error("Failed pattern match");
    })() + ((function () {
        if (flags.sticky) {
            return "y";
        };
        if (!flags.sticky) {
            return "";
        };
        throw new Error("Failed pattern match");
    })() + (function () {
        if (flags.unicode) {
            return "u";
        };
        if (!flags.unicode) {
            return "";
        };
        throw new Error("Failed pattern match");
    })())));
};
var regex = function (source) {
    return function (flags) {
        return regex$prime(source)(renderFlags(flags));
    };
};
var parseFlags = function (s) {
    return {
        global: Data_String.indexOf("g")(s) >= 0, 
        ignoreCase: Data_String.indexOf("i")(s) >= 0, 
        multiline: Data_String.indexOf("m")(s) >= 0, 
        sticky: Data_String.indexOf("y")(s) >= 0, 
        unicode: Data_String.indexOf("u")(s) >= 0
    };
};
var noFlags = {
    global: false, 
    ignoreCase: false, 
    multiline: false, 
    sticky: false, 
    unicode: false
};
var match = function (r) {
    return function (s) {
        return _match(r, s, Data_Maybe.Just.create, Data_Maybe.Nothing.value);
    };
};
module.exports = {
    noFlags: noFlags, 
    split: split, 
    search: search, 
    "replace'": replace$prime, 
    replace: replace, 
    match: match, 
    test: test, 
    parseFlags: parseFlags, 
    renderFlags: renderFlags, 
    flags: flags, 
    source: source, 
    regex: regex, 
    showRegex: showRegex
};

},{"Data.Function":83,"Data.Maybe":89,"Data.String":106,"Prelude":130}],105:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Char = require("Data.Char");

    function charCodeAt(i) {
      return function(s) {
        if (s.length <= i) {
          throw new Error("Data.String.Unsafe.charCodeAt: Invalid index.");
        };
        return s.charCodeAt(i);
      };
    }
    ;

    function charAt(i) {
      return function(s) {
        if (s.length <= i) {
          throw new Error("Data.String.Unsafe.charAt: Invalid index.");
        };
        return s.charAt(i);
      };
    }
    ;

    function $$char(s) {
      if (s.length != 1) {
        throw new Error("Data.String.Unsafe.char: Expected string of length 1.");
      };
      return s.charAt(0);
    }
    ;
module.exports = {
    charCodeAt: charCodeAt, 
    charAt: charAt, 
    "char": $$char
};

},{"Data.Char":64,"Prelude":130}],106:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Function = require("Data.Function");
var Data_Char = require("Data.Char");
var Prelude = require("Prelude");
var Data_String_Unsafe = require("Data.String.Unsafe");
var Data_Maybe = require("Data.Maybe");

    function _charAt(i, s, Just, Nothing) {
      return i >= 0 && i < s.length ? Just(s.charAt(i)) : Nothing;
    }
    ;

    function _charCodeAt(i, s, Just, Nothing) {
      return i >= 0 && i < s.length ? Just(s.charCodeAt(i)) : Nothing;
    }
    ;

    function fromCharArray(a) {
      return a.join('');
    }
    ;

    function indexOf(x) {
      return function(s) {
        return s.indexOf(x);
      };
    }
    ;

    function indexOf$prime(x) {
      return function(startAt) {
        return function(s) {
          return s.indexOf(x, startAt);
        };
      };
    }
    ;

    function lastIndexOf(x) {
      return function(s) {
        return s.lastIndexOf(x);
      };
    }
    ;

    function lastIndexOf$prime(x) {
      return function(startAt) {
        return function(s) {
          return s.lastIndexOf(x, startAt);
        };
      };
    }
    ;

    function length(s) {
      return s.length;
    }
    ;

    function localeCompare(s1) {
      return function(s2) {
        return s1.localeCompare(s2);
      };
    }
    ;

    function replace(s1) {
      return function(s2) {
        return function(s3) {
          return s3.replace(s1, s2);
        };
      };
    }
    ;

    function take(n) {
      return function(s) {
        return s.substr(0, n);
      };
    }
    ;

    function drop(n) {
      return function(s) {
        return s.substr(n);
      };
    }
    ;

    function count(p){
      return function(s){
        var i;
        for(i = 0; i < s.length && p(s.charAt(i)); i++){};
        return i;
      };
    }
    ;

    function split(sep) {
      return function(s) {
        return s.split(sep);
      };
    }
    ;

    function toCharArray(s) {
      return s.split('');
    }
    ;

    function toLower(s) {
      return s.toLowerCase();
    }
    ;

    function toUpper(s) {
      return s.toUpperCase();
    }
    ;

    function trim(s) {
      return s.trim();
    }
    ;

    function joinWith(s) {
      return function(xs) {
        return xs.join(s);
      };
    }
    ;
var takeWhile = function (p) {
    return function (s) {
        return take(count(p)(s))(s);
    };
};
var $$null = function (s) {
    return length(s) === 0;
};
var uncons = function (s) {
    if ($$null(s)) {
        return Data_Maybe.Nothing.value;
    };
    return new Data_Maybe.Just({
        head: Data_String_Unsafe.charAt(0)(s), 
        tail: drop(1)(s)
    });
};
var fromChar = Data_Char.charString;
var singleton = fromChar;
var dropWhile = function (p) {
    return function (s) {
        return drop(count(p)(s))(s);
    };
};
var charCodeAt = function (n) {
    return function (s) {
        return _charCodeAt(n, s, Data_Maybe.Just.create, Data_Maybe.Nothing.value);
    };
};
var charAt = function (n) {
    return function (s) {
        return _charAt(n, s, Data_Maybe.Just.create, Data_Maybe.Nothing.value);
    };
};
module.exports = {
    joinWith: joinWith, 
    trim: trim, 
    toUpper: toUpper, 
    toLower: toLower, 
    toCharArray: toCharArray, 
    split: split, 
    dropWhile: dropWhile, 
    drop: drop, 
    takeWhile: takeWhile, 
    take: take, 
    count: count, 
    replace: replace, 
    localeCompare: localeCompare, 
    singleton: singleton, 
    length: length, 
    uncons: uncons, 
    "null": $$null, 
    "lastIndexOf'": lastIndexOf$prime, 
    lastIndexOf: lastIndexOf, 
    "indexOf'": indexOf$prime, 
    indexOf: indexOf, 
    fromChar: fromChar, 
    fromCharArray: fromCharArray, 
    charCodeAt: charCodeAt, 
    charAt: charAt
};

},{"Data.Char":64,"Data.Function":83,"Data.Maybe":89,"Data.String.Unsafe":105,"Prelude":130}],107:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Array = require("Data.Array");
var Data_Tuple = require("Data.Tuple");
var Data_Either = require("Data.Either");
var Data_Foldable = require("Data.Foldable");
var Data_Maybe = require("Data.Maybe");
var Data_Monoid_Additive = require("Data.Monoid.Additive");
var Data_Monoid_Dual = require("Data.Monoid.Dual");
var Data_Monoid_First = require("Data.Monoid.First");
var Data_Monoid_Last = require("Data.Monoid.Last");
var Data_Monoid_Multiplicative = require("Data.Monoid.Multiplicative");
var StateR = function (x) {
    return x;
};
var StateL = function (x) {
    return x;
};
var Traversable = function (__superclass_Data$dotFoldable$dotFoldable_1, __superclass_Prelude$dotFunctor_0, sequence, traverse) {
    this["__superclass_Data.Foldable.Foldable_1"] = __superclass_Data$dotFoldable$dotFoldable_1;
    this["__superclass_Prelude.Functor_0"] = __superclass_Prelude$dotFunctor_0;
    this.sequence = sequence;
    this.traverse = traverse;
};
var traverse = function (dict) {
    return dict.traverse;
};
var traversableTuple = new Traversable(function () {
    return Data_Foldable.foldableTuple;
}, function () {
    return Data_Tuple.functorTuple;
}, function (__dict_Applicative_1) {
    return function (_406) {
        return Prelude["<$>"]((__dict_Applicative_1["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Tuple.Tuple.create(_406.value0))(_406.value1);
    };
}, function (__dict_Applicative_0) {
    return function (f) {
        return function (_405) {
            return Prelude["<$>"]((__dict_Applicative_0["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Tuple.Tuple.create(_405.value0))(f(_405.value1));
        };
    };
});
var traversableMultiplicative = new Traversable(function () {
    return Data_Foldable.foldableMultiplicative;
}, function () {
    return Data_Monoid_Multiplicative.functorMultiplicative;
}, function (__dict_Applicative_3) {
    return function (_416) {
        return Prelude["<$>"]((__dict_Applicative_3["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_Multiplicative.Multiplicative)(_416);
    };
}, function (__dict_Applicative_2) {
    return function (f) {
        return function (_415) {
            return Prelude["<$>"]((__dict_Applicative_2["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_Multiplicative.Multiplicative)(f(_415));
        };
    };
});
var traversableMaybe = new Traversable(function () {
    return Data_Foldable.foldableMaybe;
}, function () {
    return Data_Maybe.functorMaybe;
}, function (__dict_Applicative_5) {
    return function (_404) {
        if (_404 instanceof Data_Maybe.Nothing) {
            return Prelude.pure(__dict_Applicative_5)(Data_Maybe.Nothing.value);
        };
        if (_404 instanceof Data_Maybe.Just) {
            return Prelude["<$>"]((__dict_Applicative_5["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Maybe.Just.create)(_404.value0);
        };
        throw new Error("Failed pattern match");
    };
}, function (__dict_Applicative_4) {
    return function (f) {
        return function (_403) {
            if (_403 instanceof Data_Maybe.Nothing) {
                return Prelude.pure(__dict_Applicative_4)(Data_Maybe.Nothing.value);
            };
            if (_403 instanceof Data_Maybe.Just) {
                return Prelude["<$>"]((__dict_Applicative_4["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Maybe.Just.create)(f(_403.value0));
            };
            throw new Error("Failed pattern match");
        };
    };
});
var traversableEither = new Traversable(function () {
    return Data_Foldable.foldableEither;
}, function () {
    return Data_Either.functorEither;
}, function (__dict_Applicative_7) {
    return function (_402) {
        if (_402 instanceof Data_Either.Left) {
            return Prelude.pure(__dict_Applicative_7)(new Data_Either.Left(_402.value0));
        };
        if (_402 instanceof Data_Either.Right) {
            return Prelude["<$>"]((__dict_Applicative_7["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Either.Right.create)(_402.value0);
        };
        throw new Error("Failed pattern match");
    };
}, function (__dict_Applicative_6) {
    return function (f) {
        return function (_401) {
            if (_401 instanceof Data_Either.Left) {
                return Prelude.pure(__dict_Applicative_6)(new Data_Either.Left(_401.value0));
            };
            if (_401 instanceof Data_Either.Right) {
                return Prelude["<$>"]((__dict_Applicative_6["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Either.Right.create)(f(_401.value0));
            };
            throw new Error("Failed pattern match");
        };
    };
});
var traversableDual = new Traversable(function () {
    return Data_Foldable.foldableDual;
}, function () {
    return Data_Monoid_Dual.functorDual;
}, function (__dict_Applicative_9) {
    return function (_410) {
        return Prelude["<$>"]((__dict_Applicative_9["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_Dual.Dual)(_410);
    };
}, function (__dict_Applicative_8) {
    return function (f) {
        return function (_409) {
            return Prelude["<$>"]((__dict_Applicative_8["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_Dual.Dual)(f(_409));
        };
    };
});
var traversableAdditive = new Traversable(function () {
    return Data_Foldable.foldableAdditive;
}, function () {
    return Data_Monoid_Additive.functorAdditive;
}, function (__dict_Applicative_11) {
    return function (_408) {
        return Prelude["<$>"]((__dict_Applicative_11["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_Additive.Additive)(_408);
    };
}, function (__dict_Applicative_10) {
    return function (f) {
        return function (_407) {
            return Prelude["<$>"]((__dict_Applicative_10["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_Additive.Additive)(f(_407));
        };
    };
});
var stateR = function (_398) {
    return _398;
};
var stateL = function (_397) {
    return _397;
};
var sequence = function (dict) {
    return dict.sequence;
};
var traversableArray = new Traversable(function () {
    return Data_Foldable.foldableArray;
}, function () {
    return Data_Array.functorArray;
}, function (__dict_Applicative_13) {
    return function (_400) {
        if (_400.length === 0) {
            return Prelude.pure(__dict_Applicative_13)([  ]);
        };
        if (_400.length >= 1) {
            var _1706 = _400.slice(1);
            return Prelude["<*>"](__dict_Applicative_13["__superclass_Prelude.Apply_0"]())(Prelude["<$>"]((__dict_Applicative_13["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Prelude[":"])(_400[0]))(sequence(traversableArray)(__dict_Applicative_13)(_1706));
        };
        throw new Error("Failed pattern match");
    };
}, function (__dict_Applicative_12) {
    return function (f) {
        return function (_399) {
            if (_399.length === 0) {
                return Prelude.pure(__dict_Applicative_12)([  ]);
            };
            if (_399.length >= 1) {
                var _1710 = _399.slice(1);
                return Prelude["<*>"](__dict_Applicative_12["__superclass_Prelude.Apply_0"]())(Prelude["<$>"]((__dict_Applicative_12["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Prelude[":"])(f(_399[0])))(traverse(traversableArray)(__dict_Applicative_12)(f)(_1710));
            };
            throw new Error("Failed pattern match");
        };
    };
});
var traversableFirst = new Traversable(function () {
    return Data_Foldable.foldableFirst;
}, function () {
    return Data_Monoid_First.functorFirst;
}, function (__dict_Applicative_15) {
    return function (_412) {
        return Prelude["<$>"]((__dict_Applicative_15["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_First.First)(sequence(traversableMaybe)(__dict_Applicative_15)(_412));
    };
}, function (__dict_Applicative_14) {
    return function (f) {
        return function (_411) {
            return Prelude["<$>"]((__dict_Applicative_14["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_First.First)(traverse(traversableMaybe)(__dict_Applicative_14)(f)(_411));
        };
    };
});
var traversableLast = new Traversable(function () {
    return Data_Foldable.foldableLast;
}, function () {
    return Data_Monoid_Last.functorLast;
}, function (__dict_Applicative_17) {
    return function (_414) {
        return Prelude["<$>"]((__dict_Applicative_17["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_Last.Last)(sequence(traversableMaybe)(__dict_Applicative_17)(_414));
    };
}, function (__dict_Applicative_16) {
    return function (f) {
        return function (_413) {
            return Prelude["<$>"]((__dict_Applicative_16["__superclass_Prelude.Apply_0"]())["__superclass_Prelude.Functor_0"]())(Data_Monoid_Last.Last)(traverse(traversableMaybe)(__dict_Applicative_16)(f)(_413));
        };
    };
});
var zipWithA = function (__dict_Applicative_18) {
    return function (f) {
        return function (xs) {
            return function (ys) {
                return sequence(traversableArray)(__dict_Applicative_18)(Data_Array.zipWith(f)(xs)(ys));
            };
        };
    };
};
var functorStateR = new Prelude.Functor(function (f) {
    return function (k) {
        return StateR(function (s) {
            var _1717 = stateR(k)(s);
            return new Data_Tuple.Tuple(_1717.value0, f(_1717.value1));
        });
    };
});
var functorStateL = new Prelude.Functor(function (f) {
    return function (k) {
        return StateL(function (s) {
            var _1720 = stateL(k)(s);
            return new Data_Tuple.Tuple(_1720.value0, f(_1720.value1));
        });
    };
});
var $$for = function (__dict_Applicative_23) {
    return function (__dict_Traversable_24) {
        return function (x) {
            return function (f) {
                return traverse(__dict_Traversable_24)(__dict_Applicative_23)(f)(x);
            };
        };
    };
};
var applyStateR = new Prelude.Apply(function (f) {
    return function (x) {
        return StateR(function (s) {
            var _1723 = stateR(x)(s);
            var _1724 = stateR(f)(_1723.value0);
            return new Data_Tuple.Tuple(_1724.value0, _1724.value1(_1723.value1));
        });
    };
}, function () {
    return functorStateR;
});
var applyStateL = new Prelude.Apply(function (f) {
    return function (x) {
        return StateL(function (s) {
            var _1729 = stateL(f)(s);
            var _1730 = stateL(x)(_1729.value0);
            return new Data_Tuple.Tuple(_1730.value0, _1729.value1(_1730.value1));
        });
    };
}, function () {
    return functorStateL;
});
var applicativeStateR = new Prelude.Applicative(function () {
    return applyStateR;
}, function (a) {
    return StateR(function (s) {
        return new Data_Tuple.Tuple(s, a);
    });
});
var mapAccumR = function (__dict_Traversable_19) {
    return function (f) {
        return function (s0) {
            return function (xs) {
                return stateR(traverse(__dict_Traversable_19)(applicativeStateR)(function (a) {
                    return StateR(function (s) {
                        return f(s)(a);
                    });
                })(xs))(s0);
            };
        };
    };
};
var scanr = function (__dict_Traversable_20) {
    return function (f) {
        return function (b0) {
            return function (xs) {
                return Data_Tuple.snd(mapAccumR(__dict_Traversable_20)(function (b) {
                    return function (a) {
                        var b$prime = f(a)(b);
                        return new Data_Tuple.Tuple(b$prime, b$prime);
                    };
                })(b0)(xs));
            };
        };
    };
};
var applicativeStateL = new Prelude.Applicative(function () {
    return applyStateL;
}, function (a) {
    return StateL(function (s) {
        return new Data_Tuple.Tuple(s, a);
    });
});
var mapAccumL = function (__dict_Traversable_21) {
    return function (f) {
        return function (s0) {
            return function (xs) {
                return stateL(traverse(__dict_Traversable_21)(applicativeStateL)(function (a) {
                    return StateL(function (s) {
                        return f(s)(a);
                    });
                })(xs))(s0);
            };
        };
    };
};
var scanl = function (__dict_Traversable_22) {
    return function (f) {
        return function (b0) {
            return function (xs) {
                return Data_Tuple.snd(mapAccumL(__dict_Traversable_22)(function (b) {
                    return function (a) {
                        var b$prime = f(b)(a);
                        return new Data_Tuple.Tuple(b$prime, b$prime);
                    };
                })(b0)(xs));
            };
        };
    };
};
module.exports = {
    Traversable: Traversable, 
    mapAccumR: mapAccumR, 
    mapAccumL: mapAccumL, 
    scanr: scanr, 
    scanl: scanl, 
    zipWithA: zipWithA, 
    "for": $$for, 
    sequence: sequence, 
    traverse: traverse, 
    traversableArray: traversableArray, 
    traversableEither: traversableEither, 
    traversableMaybe: traversableMaybe, 
    traversableTuple: traversableTuple, 
    traversableAdditive: traversableAdditive, 
    traversableDual: traversableDual, 
    traversableFirst: traversableFirst, 
    traversableLast: traversableLast, 
    traversableMultiplicative: traversableMultiplicative
};

},{"Data.Array":61,"Data.Either":74,"Data.Foldable":76,"Data.Maybe":89,"Data.Monoid.Additive":90,"Data.Monoid.Dual":92,"Data.Monoid.First":93,"Data.Monoid.Last":94,"Data.Monoid.Multiplicative":95,"Data.Tuple":108,"Prelude":130}],108:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Monoid = require("Data.Monoid");
var Control_Lazy = require("Control.Lazy");
var Data_Array = require("Data.Array");
var Control_Comonad = require("Control.Comonad");
var Control_Extend = require("Control.Extend");
var Tuple = (function () {
    function Tuple(value0, value1) {
        this.value0 = value0;
        this.value1 = value1;
    };
    Tuple.create = function (value0) {
        return function (value1) {
            return new Tuple(value0, value1);
        };
    };
    return Tuple;
})();
var zip = Data_Array.zipWith(Tuple.create);
var unzip = function (_261) {
    if (_261.length >= 1) {
        var _1162 = _261.slice(1);
        var _1156 = unzip(_1162);
        return new Tuple(Prelude[":"]((_261[0]).value0)(_1156.value0), Prelude[":"]((_261[0]).value1)(_1156.value1));
    };
    if (_261.length === 0) {
        return new Tuple([  ], [  ]);
    };
    throw new Error("Failed pattern match");
};
var uncurry = function (f) {
    return function (_260) {
        return f(_260.value0)(_260.value1);
    };
};
var swap = function (_262) {
    return new Tuple(_262.value1, _262.value0);
};
var snd = function (_259) {
    return _259.value1;
};
var showTuple = function (__dict_Show_0) {
    return function (__dict_Show_1) {
        return new Prelude.Show(function (_263) {
            return "Tuple (" + (Prelude.show(__dict_Show_0)(_263.value0) + (") (" + (Prelude.show(__dict_Show_1)(_263.value1) + ")")));
        });
    };
};
var semigroupoidTuple = new Prelude.Semigroupoid(function (_268) {
    return function (_269) {
        return new Tuple(_269.value0, _268.value1);
    };
});
var semigroupTuple = function (__dict_Semigroup_2) {
    return function (__dict_Semigroup_3) {
        return new Prelude.Semigroup(function (_270) {
            return function (_271) {
                return new Tuple(Prelude["<>"](__dict_Semigroup_2)(_270.value0)(_271.value0), Prelude["<>"](__dict_Semigroup_3)(_270.value1)(_271.value1));
            };
        });
    };
};
var monoidTuple = function (__dict_Monoid_6) {
    return function (__dict_Monoid_7) {
        return new Data_Monoid.Monoid(function () {
            return semigroupTuple(__dict_Monoid_6["__superclass_Prelude.Semigroup_0"]())(__dict_Monoid_7["__superclass_Prelude.Semigroup_0"]());
        }, new Tuple(Data_Monoid.mempty(__dict_Monoid_6), Data_Monoid.mempty(__dict_Monoid_7)));
    };
};
var functorTuple = new Prelude.Functor(function (f) {
    return function (_272) {
        return new Tuple(_272.value0, f(_272.value1));
    };
});
var fst = function (_258) {
    return _258.value0;
};
var lazyLazy1Tuple = function (__dict_Lazy1_9) {
    return function (__dict_Lazy1_10) {
        return new Control_Lazy.Lazy(function (f) {
            return new Tuple(Control_Lazy.defer1(__dict_Lazy1_9)(function (_254) {
                return fst(f(Prelude.unit));
            }), Control_Lazy.defer1(__dict_Lazy1_10)(function (_255) {
                return snd(f(Prelude.unit));
            }));
        });
    };
};
var lazyLazy2Tuple = function (__dict_Lazy2_11) {
    return function (__dict_Lazy2_12) {
        return new Control_Lazy.Lazy(function (f) {
            return new Tuple(Control_Lazy.defer2(__dict_Lazy2_11)(function (_256) {
                return fst(f(Prelude.unit));
            }), Control_Lazy.defer2(__dict_Lazy2_12)(function (_257) {
                return snd(f(Prelude.unit));
            }));
        });
    };
};
var lazyTuple = function (__dict_Lazy_13) {
    return function (__dict_Lazy_14) {
        return new Control_Lazy.Lazy(function (f) {
            return new Tuple(Control_Lazy.defer(__dict_Lazy_13)(function (_252) {
                return fst(f(Prelude.unit));
            }), Control_Lazy.defer(__dict_Lazy_14)(function (_253) {
                return snd(f(Prelude.unit));
            }));
        });
    };
};
var extendTuple = new Control_Extend.Extend(function (f) {
    return function (_276) {
        return new Tuple(_276.value0, f(_276));
    };
}, function () {
    return functorTuple;
});
var eqTuple = function (__dict_Eq_15) {
    return function (__dict_Eq_16) {
        return new Prelude.Eq(function (t1) {
            return function (t2) {
                return !Prelude["=="](eqTuple(__dict_Eq_15)(__dict_Eq_16))(t1)(t2);
            };
        }, function (_264) {
            return function (_265) {
                return Prelude["=="](__dict_Eq_15)(_264.value0)(_265.value0) && Prelude["=="](__dict_Eq_16)(_264.value1)(_265.value1);
            };
        });
    };
};
var ordTuple = function (__dict_Ord_4) {
    return function (__dict_Ord_5) {
        return new Prelude.Ord(function () {
            return eqTuple(__dict_Ord_4["__superclass_Prelude.Eq_0"]())(__dict_Ord_5["__superclass_Prelude.Eq_0"]());
        }, function (_266) {
            return function (_267) {
                var _1213 = Prelude.compare(__dict_Ord_4)(_266.value0)(_267.value0);
                if (_1213 instanceof Prelude.EQ) {
                    return Prelude.compare(__dict_Ord_5)(_266.value1)(_267.value1);
                };
                return _1213;
            };
        });
    };
};
var curry = function (f) {
    return function (a) {
        return function (b) {
            return f(new Tuple(a, b));
        };
    };
};
var comonadTuple = new Control_Comonad.Comonad(function () {
    return extendTuple;
}, snd);
var applyTuple = function (__dict_Semigroup_18) {
    return new Prelude.Apply(function (_273) {
        return function (_274) {
            return new Tuple(Prelude["<>"](__dict_Semigroup_18)(_273.value0)(_274.value0), _273.value1(_274.value1));
        };
    }, function () {
        return functorTuple;
    });
};
var bindTuple = function (__dict_Semigroup_17) {
    return new Prelude.Bind(function (_275) {
        return function (f) {
            var _1226 = f(_275.value1);
            return new Tuple(Prelude["<>"](__dict_Semigroup_17)(_275.value0)(_1226.value0), _1226.value1);
        };
    }, function () {
        return applyTuple(__dict_Semigroup_17);
    });
};
var applicativeTuple = function (__dict_Monoid_19) {
    return new Prelude.Applicative(function () {
        return applyTuple(__dict_Monoid_19["__superclass_Prelude.Semigroup_0"]());
    }, Tuple.create(Data_Monoid.mempty(__dict_Monoid_19)));
};
var monadTuple = function (__dict_Monoid_8) {
    return new Prelude.Monad(function () {
        return applicativeTuple(__dict_Monoid_8);
    }, function () {
        return bindTuple(__dict_Monoid_8["__superclass_Prelude.Semigroup_0"]());
    });
};
module.exports = {
    Tuple: Tuple, 
    swap: swap, 
    unzip: unzip, 
    zip: zip, 
    uncurry: uncurry, 
    curry: curry, 
    snd: snd, 
    fst: fst, 
    showTuple: showTuple, 
    eqTuple: eqTuple, 
    ordTuple: ordTuple, 
    semigroupoidTuple: semigroupoidTuple, 
    semigroupTuple: semigroupTuple, 
    monoidTuple: monoidTuple, 
    functorTuple: functorTuple, 
    applyTuple: applyTuple, 
    applicativeTuple: applicativeTuple, 
    bindTuple: bindTuple, 
    monadTuple: monadTuple, 
    extendTuple: extendTuple, 
    comonadTuple: comonadTuple, 
    lazyTuple: lazyTuple, 
    lazyLazy1Tuple: lazyLazy1Tuple, 
    lazyLazy2Tuple: lazyLazy2Tuple
};

},{"Control.Comonad":30,"Control.Extend":31,"Control.Lazy":33,"Data.Array":61,"Data.Monoid":96,"Prelude":130}],109:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Control_Monad_Eff = require("Control.Monad.Eff");
var Data_Array_ST = require("Data.Array.ST");
var Prelude = require("Prelude");
var Control_Monad_ST = require("Control.Monad.ST");
var Data_Maybe = require("Data.Maybe");
var Data_Tuple = require("Data.Tuple");
var Unfoldable = function (unfoldr) {
    this.unfoldr = unfoldr;
};
var unfoldr = function (dict) {
    return dict.unfoldr;
};
var unfoldableArray = new Unfoldable(function (f) {
    return function (b) {
        return Control_Monad_Eff.runPure(Data_Array_ST.runSTArray(function __do() {
            var _47 = Data_Array_ST.emptySTArray();
            var _46 = Control_Monad_ST.newSTRef(b)();
            (function () {
                while (!(function __do() {
                    var _45 = Control_Monad_ST.readSTRef(_46)();
                    return (function () {
                        var _2637 = f(_45);
                        if (_2637 instanceof Data_Maybe.Nothing) {
                            return Prelude["return"](Control_Monad_Eff.monadEff)(true);
                        };
                        if (_2637 instanceof Data_Maybe.Just) {
                            return function __do() {
                                Data_Array_ST.pushSTArray(_47)(_2637.value0.value0)();
                                Control_Monad_ST.writeSTRef(_46)(_2637.value0.value1)();
                                return false;
                            };
                        };
                        throw new Error("Failed pattern match");
                    })()();
                })()) {

                };
                return {};
            })();
            return _47;
        }));
    };
});
module.exports = {
    Unfoldable: Unfoldable, 
    unfoldr: unfoldr, 
    unfoldableArray: unfoldableArray
};

},{"Control.Monad.Eff":40,"Control.Monad.ST":50,"Data.Array.ST":60,"Data.Maybe":89,"Data.Tuple":108,"Prelude":130}],110:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Control_Alternative = require("Control.Alternative");
var Valid = (function () {
    function Valid(value0) {
        this.value0 = value0;
    };
    Valid.create = function (value0) {
        return new Valid(value0);
    };
    return Valid;
})();
var Invalid = (function () {
    function Invalid(value0) {
        this.value0 = value0;
    };
    Invalid.create = function (value0) {
        return new Invalid(value0);
    };
    return Invalid;
})();
var showV = function (__dict_Show_0) {
    return function (__dict_Show_1) {
        return new Prelude.Show(function (_735) {
            if (_735 instanceof Invalid) {
                return "Invalid (" + (Prelude.show(__dict_Show_0)(_735.value0) + ")");
            };
            if (_735 instanceof Valid) {
                return "Valid (" + (Prelude.show(__dict_Show_1)(_735.value0) + ")");
            };
            throw new Error("Failed pattern match");
        });
    };
};
var runV = function (f) {
    return function (g) {
        return function (_733) {
            if (_733 instanceof Invalid) {
                return f(_733.value0);
            };
            if (_733 instanceof Valid) {
                return g(_733.value0);
            };
            throw new Error("Failed pattern match");
        };
    };
};
var isValid = function (_734) {
    if (_734 instanceof Valid) {
        return true;
    };
    return false;
};
var invalid = Invalid.create;
var functorV = new Prelude.Functor(function (f) {
    return function (_736) {
        if (_736 instanceof Invalid) {
            return new Invalid(_736.value0);
        };
        if (_736 instanceof Valid) {
            return new Valid(f(_736.value0));
        };
        throw new Error("Failed pattern match");
    };
});
var applyV = function (__dict_Semiring_3) {
    return new Prelude.Apply(function (_737) {
        return function (_738) {
            if (_737 instanceof Invalid && _738 instanceof Invalid) {
                return new Invalid(Prelude["*"](__dict_Semiring_3)(_737.value0)(_738.value0));
            };
            if (_737 instanceof Invalid) {
                return new Invalid(_737.value0);
            };
            if (_738 instanceof Invalid) {
                return new Invalid(_738.value0);
            };
            if (_737 instanceof Valid && _738 instanceof Valid) {
                return new Valid(_737.value0(_738.value0));
            };
            throw new Error("Failed pattern match");
        };
    }, function () {
        return functorV;
    });
};
var applicativeV = function (__dict_Semiring_4) {
    return new Prelude.Applicative(function () {
        return applyV(__dict_Semiring_4);
    }, Valid.create);
};
var altV = function (__dict_Semiring_5) {
    return new Control_Alt.Alt(function (_739) {
        return function (_740) {
            if (_739 instanceof Invalid && _740 instanceof Invalid) {
                return new Invalid(Prelude["+"](__dict_Semiring_5)(_739.value0)(_740.value0));
            };
            if (_739 instanceof Invalid) {
                return _740;
            };
            if (_739 instanceof Valid) {
                return new Valid(_739.value0);
            };
            throw new Error("Failed pattern match");
        };
    }, function () {
        return functorV;
    });
};
var plusV = function (__dict_Semiring_2) {
    return new Control_Plus.Plus(function () {
        return altV(__dict_Semiring_2);
    }, new Invalid(Prelude.zero(__dict_Semiring_2)));
};
var alernativeV = function (__dict_Semiring_6) {
    return new Control_Alternative.Alternative(function () {
        return plusV(__dict_Semiring_6);
    }, function () {
        return applicativeV(__dict_Semiring_6);
    });
};
module.exports = {
    isValid: isValid, 
    runV: runV, 
    invalid: invalid, 
    showV: showV, 
    functorV: functorV, 
    applyV: applyV, 
    applicativeV: applicativeV, 
    altV: altV, 
    plusV: plusV, 
    alernativeV: alernativeV
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Plus":58,"Prelude":130}],111:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Functor_Contravariant = require("Data.Functor.Contravariant");
var Void = function (x) {
    return x;
};
var showVoid = new Prelude.Show(function (_96) {
    return "Void";
});
var eqVoid = new Prelude.Eq(function (_94) {
    return function (_95) {
        return false;
    };
}, function (_92) {
    return function (_93) {
        return true;
    };
});
var absurd = function (a) {
    var spin = function (__copy__97) {
        var _97 = __copy__97;
        tco: while (true) {
            var __tco__97 = _97;
            _97 = __tco__97;
            continue tco;
        };
    };
    return spin(a);
};
var coerce = function (__dict_Contravariant_0) {
    return function (__dict_Functor_1) {
        return function (a) {
            return Prelude["<$>"](__dict_Functor_1)(absurd)(Data_Functor_Contravariant[">$<"](__dict_Contravariant_0)(absurd)(a));
        };
    };
};
module.exports = {
    Void: Void, 
    absurd: absurd, 
    coerce: coerce, 
    eqVoid: eqVoid, 
    showVoid: showVoid
};

},{"Data.Functor.Contravariant":84,"Prelude":130}],112:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Eff = require("Control.Monad.Eff");

    function trace(s) {
      return function() {
        console.log(s);
        return {};
      };
    }
    ;
var print = function (__dict_Show_0) {
    return function (o) {
        return trace(Prelude.show(__dict_Show_0)(o));
    };
};
module.exports = {
    print: print, 
    trace: trace
};

},{"Control.Monad.Eff":40,"Prelude":130}],113:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var nan = NaN;;
var infinity = Infinity;;

  function readInt(radix) {
    return function(n) {
      return parseInt(n, radix);
    };
  }
  ;
var readFloat = parseFloat;;
module.exports = {
    readFloat: readFloat, 
    readInt: readInt, 
    isFinite: isFinite, 
    infinity: infinity, 
    isNaN: isNaN, 
    nan: nan
};

},{"Prelude":130}],114:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Bifunctor = require("Data.Bifunctor");
var Halogen_HTML = require("Halogen.HTML");
var Halogen_Signal = require("Halogen.Signal");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");
var Data_Int = require("Data.Int");
var Data_Maybe = require("Data.Maybe");
var Data_Either = require("Data.Either");
var Control_Monad_Eff = require("Control.Monad.Eff");
var mapP = function (f) {
    return function (sf) {
        return Prelude["<$>"](Halogen_Signal.functorSF1)(Data_Bifunctor.lmap(Halogen_HTML.bifunctorHTML)(f))(sf);
    };
};
var install = function (__dict_Functor_0) {
    return function (c) {
        return function (f) {
            return Prelude["<$>"](Halogen_Signal.functorSF1)(function (_1) {
                return Halogen_HTML.graft(_1)(f);
            })(c);
        };
    };
};
var hoistComponent = function (f) {
    return function (sf) {
        return Prelude["<$>"](Halogen_Signal.functorSF1)(Data_Bifunctor.rmap(Halogen_HTML.bifunctorHTML)(f))(sf);
    };
};
var combine = function (__dict_Functor_1) {
    return function (f) {
        var f1 = function (n1) {
            return function (n2) {
                return f(Data_Bifunctor.rmap(Halogen_HTML.bifunctorHTML)(Prelude["<$>"](__dict_Functor_1)(Data_Either.Left.create))(n1))(Data_Bifunctor.rmap(Halogen_HTML.bifunctorHTML)(Prelude["<$>"](__dict_Functor_1)(Data_Either.Right.create))(n2));
            };
        };
        return Halogen_Signal.mergeWith(f1);
    };
};
module.exports = {
    hoistComponent: hoistComponent, 
    mapP: mapP, 
    combine: combine, 
    install: install
};

},{"Control.Monad.Eff":40,"Data.Bifunctor":62,"Data.DOM.Simple.Types":68,"Data.Either":74,"Data.Int":86,"Data.Maybe":89,"Halogen.HTML":122,"Halogen.Signal":124,"Prelude":130}],115:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Exists = require("Data.Exists");
var Data_String = require("Data.String");
var Data_StrMap = require("Data.StrMap");
var Data_Array = require("Data.Array");
var DOM = require("DOM");
var Data_Maybe = require("Data.Maybe");
var Data_Tuple = require("Data.Tuple");
var Data_Either = require("Data.Either");
var Data_Foreign = require("Data.Foreign");
var Data_Monoid = require("Data.Monoid");
var Data_Traversable = require("Data.Traversable");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Control_Monad_ST = require("Control.Monad.ST");
var Halogen_Internal_VirtualDOM = require("Halogen.Internal.VirtualDOM");
var Halogen_HTML_Events_Types = require("Halogen.HTML.Events.Types");
var Halogen_HTML_Events_Handler = require("Halogen.HTML.Events.Handler");
function unsafeCoerce(x) {  return x;};
var Styles = function (x) {
    return x;
};
var EventName = function (x) {
    return x;
};
var HandlerF = (function () {
    function HandlerF(value0, value1) {
        this.value0 = value0;
        this.value1 = value1;
    };
    HandlerF.create = function (value0) {
        return function (value1) {
            return new HandlerF(value0, value1);
        };
    };
    return HandlerF;
})();
var ClassName = function (x) {
    return x;
};
var AttributeName = function (x) {
    return x;
};
var AttrF = (function () {
    function AttrF(value0, value1, value2) {
        this.value0 = value0;
        this.value1 = value1;
        this.value2 = value2;
    };
    AttrF.create = function (value0) {
        return function (value1) {
            return function (value2) {
                return new AttrF(value0, value1, value2);
            };
        };
    };
    return AttrF;
})();
var Attr = (function () {
    function Attr(value0) {
        this.value0 = value0;
    };
    Attr.create = function (value0) {
        return new Attr(value0);
    };
    return Attr;
})();
var Handler = (function () {
    function Handler(value0) {
        this.value0 = value0;
    };
    Handler.create = function (value0) {
        return new Handler(value0);
    };
    return Handler;
})();
var Initializer = (function () {
    function Initializer(value0) {
        this.value0 = value0;
    };
    Initializer.create = function (value0) {
        return new Initializer(value0);
    };
    return Initializer;
})();
var Finalizer = (function () {
    function Finalizer(value0) {
        this.value0 = value0;
    };
    Finalizer.create = function (value0) {
        return new Finalizer(value0);
    };
    return Finalizer;
})();
var IsAttribute = function (toAttrString) {
    this.toAttrString = toAttrString;
};
var toAttrString = function (dict) {
    return dict.toAttrString;
};
var styles = Styles;
var stringIsAttribute = new IsAttribute(function (_78) {
    return function (s) {
        return s;
    };
});
var runStyles = function (_76) {
    return _76;
};
var runExistsR = unsafeCoerce;
var runEventName = function (_75) {
    return _75;
};
var runClassName = function (_73) {
    return _73;
};
var runAttributeName = function (_74) {
    return _74;
};
var numberIsAttribute = new IsAttribute(function (_79) {
    return function (n) {
        return Prelude.show(Prelude.showNumber)(n);
    };
});
var mkExistsR = unsafeCoerce;
var initializer = Initializer.create;
var handler = function (name_1) {
    return function (k) {
        return new Handler(mkExistsR(new HandlerF(name_1, k)));
    };
};
var finalizer = Finalizer.create;
var eventName = EventName;
var className = ClassName;
var booleanIsAttribute = new IsAttribute(function (name_1) {
    return function (_80) {
        if (_80) {
            return runAttributeName(name_1);
        };
        if (!_80) {
            return "";
        };
        throw new Error("Failed pattern match");
    };
});
var attributeName = AttributeName;
var attr = function (__dict_IsAttribute_0) {
    return function (name_1) {
        return function (v) {
            return new Attr(Data_Exists.mkExists(new AttrF(toAttrString(__dict_IsAttribute_0), name_1, v)));
        };
    };
};
var charset = attr(stringIsAttribute)(attributeName("charset"));
var checked = attr(booleanIsAttribute)(attributeName("checked"));
var class_ = Prelude["<<<"](Prelude.semigroupoidArr)(attr(stringIsAttribute)(attributeName("className")))(runClassName);
var classes = function (ss) {
    return attr(stringIsAttribute)(attributeName("className"))(Data_String.joinWith(" ")(Data_Array.map(runClassName)(ss)));
};
var colSpan = Prelude["<<<"](Prelude.semigroupoidArr)(attr(stringIsAttribute)(attributeName("colSpan")))(Prelude.show(Prelude.showNumber));
var content = attr(stringIsAttribute)(attributeName("content"));
var disabled = attr(booleanIsAttribute)(attributeName("disabled"));
var enabled = Prelude["<<<"](Prelude.semigroupoidArr)(disabled)(Prelude.not(Prelude.boolLikeBoolean));
var $$for = attr(stringIsAttribute)(attributeName("for"));
var height = Prelude["<<<"](Prelude.semigroupoidArr)(attr(stringIsAttribute)(attributeName("height")))(Prelude.show(Prelude.showNumber));
var href = attr(stringIsAttribute)(attributeName("href"));
var httpEquiv = attr(stringIsAttribute)(attributeName("http-equiv"));
var id_ = attr(stringIsAttribute)(attributeName("id"));
var name = attr(stringIsAttribute)(attributeName("name"));
var functorAttr = new Prelude.Functor(function (f) {
    return function (_77) {
        if (_77 instanceof Attr) {
            return new Attr(_77.value0);
        };
        if (_77 instanceof Handler) {
            return runExistsR(function (_71) {
                return new Handler(mkExistsR(new HandlerF(_71.value0, function (e_2) {
                    return Prelude["<$>"](Halogen_HTML_Events_Handler.functorEventHandler)(f)(_71.value1(e_2));
                })));
            })(_77.value0);
        };
        if (_77 instanceof Initializer) {
            return new Initializer(f(_77.value0));
        };
        if (_77 instanceof Finalizer) {
            return new Finalizer(f(_77.value0));
        };
        throw new Error("Failed pattern match");
    };
});
var placeholder = attr(stringIsAttribute)(attributeName("placeholder"));
var readonly = attr(booleanIsAttribute)(attributeName("readonly"));
var rel = attr(stringIsAttribute)(attributeName("rel"));
var required = attr(booleanIsAttribute)(attributeName("required"));
var rowSpan = Prelude["<<<"](Prelude.semigroupoidArr)(attr(stringIsAttribute)(attributeName("rowSpan")))(Prelude.show(Prelude.showNumber));
var selected = attr(booleanIsAttribute)(attributeName("selected"));
var spellcheck = attr(booleanIsAttribute)(attributeName("spellcheck"));
var src = attr(stringIsAttribute)(attributeName("src"));
var target = attr(stringIsAttribute)(attributeName("target"));
var title = attr(stringIsAttribute)(attributeName("title"));
var type_ = attr(stringIsAttribute)(attributeName("type"));
var value = attr(stringIsAttribute)(attributeName("value"));
var stylesIsAttribute = new IsAttribute(function (_81) {
    return function (_82) {
        return Data_String.joinWith("; ")(Prelude["<$>"](Data_Array.functorArray)(function (_72) {
            return _72.value0 + (": " + _72.value1);
        })(Data_StrMap.toList(_82)));
    };
});
var style = attr(stylesIsAttribute)(attributeName("style"));
var width = Prelude["<<<"](Prelude.semigroupoidArr)(attr(stringIsAttribute)(attributeName("width")))(Prelude.show(Prelude.showNumber));
var alt = attr(stringIsAttribute)(attributeName("alt"));
module.exports = {
    Attr: Attr, 
    Handler: Handler, 
    Initializer: Initializer, 
    Finalizer: Finalizer, 
    HandlerF: HandlerF, 
    AttrF: AttrF, 
    IsAttribute: IsAttribute, 
    style: style, 
    placeholder: placeholder, 
    selected: selected, 
    checked: checked, 
    enabled: enabled, 
    spellcheck: spellcheck, 
    readonly: readonly, 
    required: required, 
    disabled: disabled, 
    width: width, 
    value: value, 
    type_: type_, 
    title: title, 
    target: target, 
    src: src, 
    rel: rel, 
    name: name, 
    id_: id_, 
    httpEquiv: httpEquiv, 
    href: href, 
    height: height, 
    "for": $$for, 
    content: content, 
    rowSpan: rowSpan, 
    colSpan: colSpan, 
    classes: classes, 
    class_: class_, 
    charset: charset, 
    alt: alt, 
    finalizer: finalizer, 
    initializer: initializer, 
    handler: handler, 
    attr: attr, 
    runExistsR: runExistsR, 
    mkExistsR: mkExistsR, 
    toAttrString: toAttrString, 
    runStyles: runStyles, 
    styles: styles, 
    runEventName: runEventName, 
    eventName: eventName, 
    runAttributeName: runAttributeName, 
    attributeName: attributeName, 
    runClassName: runClassName, 
    className: className, 
    functorAttr: functorAttr, 
    stringIsAttribute: stringIsAttribute, 
    numberIsAttribute: numberIsAttribute, 
    booleanIsAttribute: booleanIsAttribute, 
    stylesIsAttribute: stylesIsAttribute
};

},{"Control.Monad.Eff":40,"Control.Monad.ST":50,"DOM":59,"Data.Array":61,"Data.Either":74,"Data.Exists":75,"Data.Foreign":82,"Data.Maybe":89,"Data.Monoid":96,"Data.StrMap":103,"Data.String":106,"Data.Traversable":107,"Data.Tuple":108,"Halogen.HTML.Events.Handler":117,"Halogen.HTML.Events.Types":119,"Halogen.Internal.VirtualDOM":123,"Prelude":130}],116:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Foreign_Class = require("Data.Foreign.Class");
var Prelude = require("Prelude");
var Control_Plus = require("Control.Plus");
var Halogen_HTML_Attributes = require("Halogen.HTML.Attributes");
var Data_Foreign = require("Data.Foreign");
var DOM = require("DOM");
var Data_Maybe = require("Data.Maybe");
var Data_Either = require("Data.Either");
var Data_Traversable = require("Data.Traversable");
var Control_Alternative = require("Control.Alternative");
var Halogen_HTML_Events_Handler = require("Halogen.HTML.Events.Handler");
var Data_Foreign_Index = require("Data.Foreign.Index");
var addForeignPropHandler = function (__dict_Alternative_0) {
    return function (__dict_IsForeign_1) {
        return function (key) {
            return function (prop) {
                return function (f) {
                    var handler = function (e) {
                        var _305 = Data_Foreign_Class.readProp(__dict_IsForeign_1)(Data_Foreign_Index.indexString)(prop)(e);
                        if (_305 instanceof Data_Either.Left) {
                            return Prelude.pure(Halogen_HTML_Events_Handler.applicativeEventHandler)(Control_Plus.empty(__dict_Alternative_0["__superclass_Control.Plus.Plus_1"]()));
                        };
                        if (_305 instanceof Data_Either.Right) {
                            return f(_305.value0);
                        };
                        throw new Error("Failed pattern match");
                    };
                    return Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName(key))(function (e) {
                        return handler(Data_Foreign.toForeign(e.target));
                    });
                };
            };
        };
    };
};
var onChecked = function (__dict_Alternative_2) {
    return addForeignPropHandler(__dict_Alternative_2)(Data_Foreign_Class.booleanIsForeign)("change")("checked");
};
var onInput = function (__dict_Alternative_3) {
    return function (__dict_IsForeign_4) {
        return addForeignPropHandler(__dict_Alternative_3)(__dict_IsForeign_4)("input")("value");
    };
};
var onValueChanged = function (__dict_Alternative_5) {
    return function (__dict_IsForeign_6) {
        return addForeignPropHandler(__dict_Alternative_5)(__dict_IsForeign_6)("change")("value");
    };
};
module.exports = {
    onInput: onInput, 
    onChecked: onChecked, 
    onValueChanged: onValueChanged
};

},{"Control.Alternative":27,"Control.Plus":58,"DOM":59,"Data.Either":74,"Data.Foreign":82,"Data.Foreign.Class":77,"Data.Foreign.Index":78,"Data.Maybe":89,"Data.Traversable":107,"Halogen.HTML.Attributes":115,"Halogen.HTML.Events.Handler":117,"Prelude":130}],117:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Control_Monad_Writer_Class = require("Control.Monad.Writer.Class");
var Prelude = require("Prelude");
var Control_Monad_Writer = require("Control.Monad.Writer");
var Control_Apply = require("Control.Apply");
var Data_Foldable = require("Data.Foldable");
var DOM = require("DOM");
var Data_Maybe = require("Data.Maybe");
var Data_Tuple = require("Data.Tuple");
var Data_Array = require("Data.Array");
var Control_Plus = require("Control.Plus");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Control_Monad_Writer_Trans = require("Control.Monad.Writer.Trans");
var Halogen_HTML_Events_Types = require("Halogen.HTML.Events.Types");
var Data_Monoid = require("Data.Monoid");
var Data_Identity = require("Data.Identity");
function preventDefaultImpl(e) {  return function() {    e.preventDefault();  };};
function stopPropagationImpl(e) {  return function() {    e.stopPropagation();  };};
function stopImmediatePropagationImpl(e) {  return function() {    e.stopImmediatePropagation();  };};
var PreventDefault = (function () {
    function PreventDefault() {

    };
    PreventDefault.value = new PreventDefault();
    return PreventDefault;
})();
var StopPropagation = (function () {
    function StopPropagation() {

    };
    StopPropagation.value = new StopPropagation();
    return StopPropagation;
})();
var StopImmediatePropagation = (function () {
    function StopImmediatePropagation() {

    };
    StopImmediatePropagation.value = new StopImmediatePropagation();
    return StopImmediatePropagation;
})();
var EventHandler = function (x) {
    return x;
};
var unEventHandler = function (_64) {
    return _64;
};
var stopPropagation = Control_Monad_Writer_Class.tell(Data_Monoid.monoidArray)(Control_Monad_Writer_Trans.monadWriterT(Data_Monoid.monoidArray)(Data_Identity.monadIdentity))(Control_Monad_Writer_Class.monadWriterWriterT(Data_Monoid.monoidArray)(Data_Identity.monadIdentity))([ StopPropagation.value ]);
var stopImmediatePropagation = Control_Monad_Writer_Class.tell(Data_Monoid.monoidArray)(Control_Monad_Writer_Trans.monadWriterT(Data_Monoid.monoidArray)(Data_Identity.monadIdentity))(Control_Monad_Writer_Class.monadWriterWriterT(Data_Monoid.monoidArray)(Data_Identity.monadIdentity))([ StopImmediatePropagation.value ]);
var runEventHandler = function (e) {
    return function (_65) {
        var applyUpdate = function (_70) {
            if (_70 instanceof PreventDefault) {
                return preventDefaultImpl(e);
            };
            if (_70 instanceof StopPropagation) {
                return stopPropagationImpl(e);
            };
            if (_70 instanceof StopImmediatePropagation) {
                return stopImmediatePropagationImpl(e);
            };
            throw new Error("Failed pattern match");
        };
        var _256 = Control_Monad_Writer.runWriter(_65);
        return Control_Apply["*>"](Control_Monad_Eff.applyEff)(Data_Foldable.for_(Control_Monad_Eff.applicativeEff)(Data_Foldable.foldableArray)(_256.value1)(applyUpdate))(Prelude["return"](Control_Monad_Eff.monadEff)(_256.value0));
    };
};
var preventDefault = Control_Monad_Writer_Class.tell(Data_Monoid.monoidArray)(Control_Monad_Writer_Trans.monadWriterT(Data_Monoid.monoidArray)(Data_Identity.monadIdentity))(Control_Monad_Writer_Class.monadWriterWriterT(Data_Monoid.monoidArray)(Data_Identity.monadIdentity))([ PreventDefault.value ]);
var functorEventHandler = new Prelude.Functor(function (f) {
    return function (_66) {
        return Prelude["<$>"](Control_Monad_Writer_Trans.functorWriterT(Data_Identity.functorIdentity))(f)(_66);
    };
});
var applyEventHandler = new Prelude.Apply(function (_67) {
    return function (_68) {
        return Prelude["<*>"](Control_Monad_Writer_Trans.applyWriterT(Data_Monoid.monoidArray)(Data_Identity.applyIdentity))(_67)(_68);
    };
}, function () {
    return functorEventHandler;
});
var bindEventHandler = new Prelude.Bind(function (_69) {
    return function (f) {
        return Prelude[">>="](Control_Monad_Writer_Trans.bindWriterT(Data_Monoid.monoidArray)(Data_Identity.monadIdentity))(_69)(Prelude["<<<"](Prelude.semigroupoidArr)(unEventHandler)(f));
    };
}, function () {
    return applyEventHandler;
});
var applicativeEventHandler = new Prelude.Applicative(function () {
    return applyEventHandler;
}, Prelude["<<<"](Prelude.semigroupoidArr)(EventHandler)(Prelude.pure(Control_Monad_Writer_Trans.applicativeWriterT(Data_Monoid.monoidArray)(Data_Identity.applicativeIdentity))));
var monadEventHandler = new Prelude.Monad(function () {
    return applicativeEventHandler;
}, function () {
    return bindEventHandler;
});
module.exports = {
    runEventHandler: runEventHandler, 
    stopImmediatePropagation: stopImmediatePropagation, 
    stopPropagation: stopPropagation, 
    preventDefault: preventDefault, 
    functorEventHandler: functorEventHandler, 
    applyEventHandler: applyEventHandler, 
    applicativeEventHandler: applicativeEventHandler, 
    bindEventHandler: bindEventHandler, 
    monadEventHandler: monadEventHandler
};

},{"Control.Apply":28,"Control.Monad.Eff":40,"Control.Monad.Writer":55,"Control.Monad.Writer.Class":53,"Control.Monad.Writer.Trans":54,"Control.Plus":58,"DOM":59,"Data.Array":61,"Data.Foldable":76,"Data.Identity":85,"Data.Maybe":89,"Data.Monoid":96,"Data.Tuple":108,"Halogen.HTML.Events.Types":119,"Prelude":130}],118:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Control_Monad_Aff = require("Control.Monad.Aff");
var Control_Monad_ListT = require("Control.Monad.ListT");
var Prelude = require("Prelude");
var Control_Apply = require("Control.Apply");
var Control_Monad_Aff_Class = require("Control.Monad.Aff.Class");
var Data_Monoid = require("Data.Monoid");
var Control_Monad_Trans = require("Control.Monad.Trans");
var Control_Monad_Eff_Class = require("Control.Monad.Eff.Class");
var Control_Alt = require("Control.Alt");
var Control_Plus = require("Control.Plus");
var Data_Tuple = require("Data.Tuple");
var Data_Maybe = require("Data.Maybe");
var Control_Alternative = require("Control.Alternative");
var Control_MonadPlus = require("Control.MonadPlus");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Control_Monad_Eff_Exception = require("Control.Monad.Eff.Exception");
var Event = function (x) {
    return x;
};
var unEvent = function (_7) {
    return _7;
};
var semigroupEvent = new Prelude.Semigroup(function (_10) {
    return function (_11) {
        return Prelude["<>"](Control_Monad_ListT.semigroupListT(Control_Monad_Aff.applicativeAff))(_10)(_11);
    };
});
var runEvent = function (f) {
    return function (s) {
        var handler = function (_9) {
            if (_9 instanceof Data_Maybe.Nothing) {
                return Prelude["return"](Control_Monad_Eff.monadEff)(Prelude.unit);
            };
            if (_9 instanceof Data_Maybe.Just) {
                return Control_Apply["*>"](Control_Monad_Eff.applyEff)(s(_9.value0.value0))(go(_9.value0.value1));
            };
            throw new Error("Failed pattern match");
        };
        var go = function (l) {
            return Control_Monad_Aff.runAff(f)(handler)(Control_Monad_Aff.later(Control_Monad_ListT.uncons(Control_Monad_Aff.monadAff)(l)));
        };
        return Prelude["<<<"](Prelude.semigroupoidArr)(go)(unEvent);
    };
};
var monoidEvent = new Data_Monoid.Monoid(function () {
    return semigroupEvent;
}, Data_Monoid.mempty(Control_Monad_ListT.monoidListT(Control_Monad_Aff.applicativeAff)));
var monadAffEvent = new Control_Monad_Aff_Class.MonadAff(Prelude["<<<"](Prelude.semigroupoidArr)(Event)(Control_Monad_Trans.lift(Control_Monad_ListT.monadTransListT)(Control_Monad_Aff.monadAff)));
var functorEvent = new Prelude.Functor(function (f) {
    return function (_12) {
        return Prelude["<$>"](Control_Monad_ListT.functorListT(Control_Monad_Aff.functorAff))(f)(_12);
    };
});
var async = Control_Monad_Aff_Class.liftAff(monadAffEvent);
var $$yield = Prelude["<<<"](Prelude.semigroupoidArr)(async)(Prelude.pure(Control_Monad_Aff.applicativeAff));
var applyEvent = new Prelude.Apply(function (_13) {
    return function (_14) {
        return Prelude["<*>"](Control_Monad_ListT.applyListT(Control_Monad_Aff.monadAff))(_13)(_14);
    };
}, function () {
    return functorEvent;
});
var bindEvent = new Prelude.Bind(function (_15) {
    return function (f) {
        return Prelude[">>="](Control_Monad_ListT.bindListT(Control_Monad_Aff.monadAff))(_15)(Prelude[">>>"](Prelude.semigroupoidArr)(f)(unEvent));
    };
}, function () {
    return applyEvent;
});
var applicativeEvent = new Prelude.Applicative(function () {
    return applyEvent;
}, Prelude["<<<"](Prelude.semigroupoidArr)(Event)(Prelude.pure(Control_Monad_ListT.applicativeListT(Control_Monad_Aff.monadAff))));
var monadEvent = new Prelude.Monad(function () {
    return applicativeEvent;
}, function () {
    return bindEvent;
});
var monadEffEvent = new Control_Monad_Eff_Class.MonadEff(function () {
    return monadEvent;
}, Prelude["<<<"](Prelude.semigroupoidArr)(Event)(Prelude["<<<"](Prelude.semigroupoidArr)(Control_Monad_Trans.lift(Control_Monad_ListT.monadTransListT)(Control_Monad_Aff.monadAff))(Control_Monad_Eff_Class.liftEff(Control_Monad_Aff.monadEffAff))));
var andThen = function (_8) {
    return function (f) {
        var go = function (l_1) {
            return Control_Monad_ListT.wrapEffect(Control_Monad_Aff.monadAff)(Prelude[">>="](Control_Monad_Aff.bindAff)(Control_Monad_ListT.uncons(Control_Monad_Aff.monadAff)(l_1))(function (_0) {
                return Prelude["return"](Control_Monad_Aff.monadAff)((function () {
                    if (_0 instanceof Data_Maybe.Nothing) {
                        return Control_Monad_ListT.nil(Control_Monad_Aff.applicativeAff);
                    };
                    if (_0 instanceof Data_Maybe.Just) {
                        return Prelude["<>"](Control_Monad_ListT.semigroupListT(Control_Monad_Aff.applicativeAff))(Control_Monad_ListT.singleton(Control_Monad_Aff.applicativeAff)(_0.value0.value0))(Prelude["<>"](Control_Monad_ListT.semigroupListT(Control_Monad_Aff.applicativeAff))(unEvent(f(_0.value0.value0)))(go(_0.value0.value1)));
                    };
                    throw new Error("Failed pattern match");
                })());
            }));
        };
        return go(_8);
    };
};
var altEvent = new Control_Alt.Alt(function (_16) {
    return function (_17) {
        return Control_Alt["<|>"](Control_Monad_ListT.altListT(Control_Monad_Aff.applicativeAff))(_16)(_17);
    };
}, function () {
    return functorEvent;
});
var plusEvent = new Control_Plus.Plus(function () {
    return altEvent;
}, Control_Plus.empty(Control_Monad_ListT.plusListT(Control_Monad_Aff.monadAff)));
var alternativeEvent = new Control_Alternative.Alternative(function () {
    return plusEvent;
}, function () {
    return applicativeEvent;
});
var monadPlusEvent = new Control_MonadPlus.MonadPlus(function () {
    return alternativeEvent;
}, function () {
    return monadEvent;
});
module.exports = {
    Event: Event, 
    andThen: andThen, 
    async: async, 
    "yield": $$yield, 
    runEvent: runEvent, 
    unEvent: unEvent, 
    semigroupEvent: semigroupEvent, 
    monoidEvent: monoidEvent, 
    functorEvent: functorEvent, 
    applyEvent: applyEvent, 
    applicativeEvent: applicativeEvent, 
    bindEvent: bindEvent, 
    monadEvent: monadEvent, 
    monadEffEvent: monadEffEvent, 
    monadAffEvent: monadAffEvent, 
    altEvent: altEvent, 
    plusEvent: plusEvent, 
    alternativeEvent: alternativeEvent, 
    monadPlusEvent: monadPlusEvent
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Apply":28,"Control.Monad.Aff":35,"Control.Monad.Aff.Class":34,"Control.Monad.Eff":40,"Control.Monad.Eff.Class":36,"Control.Monad.Eff.Exception":37,"Control.Monad.ListT":45,"Control.Monad.Trans":52,"Control.MonadPlus":57,"Control.Plus":58,"Data.Maybe":89,"Data.Monoid":96,"Data.Tuple":108,"Prelude":130}],119:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");
module.exports = {};

},{"Data.DOM.Simple.Types":68,"Prelude":130}],120:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Halogen_HTML_Attributes = require("Halogen.HTML.Attributes");
var Data_Maybe = require("Data.Maybe");
var Halogen_HTML_Events_Handler = require("Halogen.HTML.Events.Handler");
var Halogen_HTML_Events_Types = require("Halogen.HTML.Events.Types");
var onUnload = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("unload"));
var onSubmit = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("submit"));
var onSelect = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("select"));
var onSearch = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("search"));
var onScroll = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("scroll"));
var onResize = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("resize"));
var onReset = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("reset"));
var onPageShow = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("pageshow"));
var onPageHide = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("pagehide"));
var onMouseUp = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("mouseup"));
var onMouseOver = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("mouseover"));
var onMouseOut = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("mouseout"));
var onMouseMove = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("mousemove"));
var onMouseLeave = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("mouseleave"));
var onMouseEnter = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("mouseenter"));
var onMouseDown = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("mousedown"));
var onLoad = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("load"));
var onKeyUp = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("keyup"));
var onKeyPress = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("keypress"));
var onKeyDown = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("keydown"));
var onInvalid = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("invalid"));
var onHashChange = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("hashchange"));
var onFocusOut = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("focusout"));
var onFocusIn = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("focusin"));
var onFocus = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("focus"));
var onError = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("error"));
var onDoubleClick = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("dblclick"));
var onContextMenu = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("contextmenu"));
var onClick = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("click"));
var onChange = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("change"));
var onBlur = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("blur"));
var onBeforeUnload = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("beforeunload"));
var onAbort = Halogen_HTML_Attributes.handler(Halogen_HTML_Attributes.eventName("abort"));
var input_ = function (__dict_Applicative_0) {
    return function (x) {
        return function (_86) {
            return Prelude.pure(Halogen_HTML_Events_Handler.applicativeEventHandler)(Prelude.pure(__dict_Applicative_0)(x));
        };
    };
};
var input = function (__dict_Applicative_1) {
    return function (f) {
        return function (e) {
            return Prelude.pure(Halogen_HTML_Events_Handler.applicativeEventHandler)(Prelude.pure(__dict_Applicative_1)(f(e)));
        };
    };
};
module.exports = {
    onFocusOut: onFocusOut, 
    onFocusIn: onFocusIn, 
    onFocus: onFocus, 
    onBlur: onBlur, 
    onKeyUp: onKeyUp, 
    onKeyPress: onKeyPress, 
    onKeyDown: onKeyDown, 
    onMouseUp: onMouseUp, 
    onMouseOut: onMouseOut, 
    onMouseOver: onMouseOver, 
    onMouseMove: onMouseMove, 
    onMouseLeave: onMouseLeave, 
    onMouseEnter: onMouseEnter, 
    onMouseDown: onMouseDown, 
    onDoubleClick: onDoubleClick, 
    onContextMenu: onContextMenu, 
    onClick: onClick, 
    onSubmit: onSubmit, 
    onSelect: onSelect, 
    onSearch: onSearch, 
    onReset: onReset, 
    onInvalid: onInvalid, 
    onChange: onChange, 
    onUnload: onUnload, 
    onScroll: onScroll, 
    onResize: onResize, 
    onPageHide: onPageHide, 
    onPageShow: onPageShow, 
    onLoad: onLoad, 
    onHashChange: onHashChange, 
    onError: onError, 
    onBeforeUnload: onBeforeUnload, 
    onAbort: onAbort, 
    input_: input_, 
    input: input
};

},{"Data.Maybe":89,"Halogen.HTML.Attributes":115,"Halogen.HTML.Events.Handler":117,"Halogen.HTML.Events.Types":119,"Prelude":130}],121:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Exists = require("Data.Exists");
var Data_Function = require("Data.Function");
var Halogen_Internal_VirtualDOM = require("Halogen.Internal.VirtualDOM");
var Halogen_HTML_Attributes = require("Halogen.HTML.Attributes");
var Prelude = require("Prelude");
var Control_Monad_Eff_Unsafe = require("Control.Monad.Eff.Unsafe");
var Halogen_HTML_Events_Handler = require("Halogen.HTML.Events.Handler");
var Halogen_HTML = require("Halogen.HTML");
var Data_Foldable = require("Data.Foldable");
var Data_Array = require("Data.Array");
var Data_Void = require("Data.Void");
var Data_Monoid = require("Data.Monoid");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Halogen_HTML_Events_Types = require("Halogen.HTML.Events.Types");
var renderAttr = function (dr) {
    return function (_92) {
        if (_92 instanceof Halogen_HTML_Attributes.Attr) {
            return Data_Exists.runExists(function (_90) {
                return Halogen_Internal_VirtualDOM.prop(Halogen_HTML_Attributes.runAttributeName(_90.value1), _90.value2);
            })(_92.value0);
        };
        if (_92 instanceof Halogen_HTML_Attributes.Handler) {
            return Halogen_HTML_Attributes.runExistsR(function (_91) {
                return Halogen_Internal_VirtualDOM.handlerProp(Halogen_HTML_Attributes.runEventName(_91.value0), function (ev) {
                    return function __do() {
                        var _7 = Control_Monad_Eff_Unsafe.unsafeInterleaveEff(Halogen_HTML_Events_Handler.runEventHandler(ev)(_91.value1(ev)))();
                        return dr(_7)();
                    };
                });
            })(_92.value0);
        };
        if (_92 instanceof Halogen_HTML_Attributes.Initializer) {
            return Halogen_Internal_VirtualDOM.initProp(dr(_92.value0));
        };
        if (_92 instanceof Halogen_HTML_Attributes.Finalizer) {
            return Halogen_Internal_VirtualDOM.finalizerProp(dr(_92.value0));
        };
        throw new Error("Failed pattern match");
    };
};
var renderHTML = function (f) {
    var go = function (_93) {
        if (_93 instanceof Halogen_HTML.Text) {
            return Halogen_Internal_VirtualDOM.vtext(_93.value0);
        };
        if (_93 instanceof Halogen_HTML.Element) {
            return Halogen_Internal_VirtualDOM.vnode(Halogen_HTML.runTagName(_93.value0))(Data_Foldable.foldMap(Data_Foldable.foldableArray)(Halogen_Internal_VirtualDOM.monoidProps)(renderAttr(f))(_93.value1))(Data_Array.map(go)(_93.value2));
        };
        throw new Error("Failed pattern match");
    };
    return go;
};
module.exports = {
    renderHTML: renderHTML
};

},{"Control.Monad.Eff":40,"Control.Monad.Eff.Unsafe":39,"Data.Array":61,"Data.Exists":75,"Data.Foldable":76,"Data.Function":83,"Data.Monoid":96,"Data.Void":111,"Halogen.HTML":122,"Halogen.HTML.Attributes":115,"Halogen.HTML.Events.Handler":117,"Halogen.HTML.Events.Types":119,"Halogen.Internal.VirtualDOM":123,"Prelude":130}],122:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Bifunctor = require("Data.Bifunctor");
var Data_Monoid = require("Data.Monoid");
var Data_Void = require("Data.Void");
var Data_Maybe = require("Data.Maybe");
var Data_Tuple = require("Data.Tuple");
var Data_Foreign = require("Data.Foreign");
var Data_Function = require("Data.Function");
var Data_StrMap = require("Data.StrMap");
var Data_String = require("Data.String");
var Data_Foldable = require("Data.Foldable");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Control_Monad_Eff_Unsafe = require("Control.Monad.Eff.Unsafe");
var Control_Monad_ST = require("Control.Monad.ST");
var Halogen_Internal_VirtualDOM = require("Halogen.Internal.VirtualDOM");
var Halogen_HTML_Attributes = require("Halogen.HTML.Attributes");
var Data_Array = require("Data.Array");
var TagName = function (x) {
    return x;
};
var Text = (function () {
    function Text(value0) {
        this.value0 = value0;
    };
    Text.create = function (value0) {
        return new Text(value0);
    };
    return Text;
})();
var Element = (function () {
    function Element(value0, value1, value2) {
        this.value0 = value0;
        this.value1 = value1;
        this.value2 = value2;
    };
    Element.create = function (value0) {
        return function (value1) {
            return function (value2) {
                return new Element(value0, value1, value2);
            };
        };
    };
    return Element;
})();
var Placeholder = (function () {
    function Placeholder(value0) {
        this.value0 = value0;
    };
    Placeholder.create = function (value0) {
        return new Placeholder(value0);
    };
    return Placeholder;
})();
var text = Text.create;
var tagName = TagName;
var placeholder = Placeholder.create;
var element = Element.create;
var em = element(tagName("em"));
var em_ = em(Data_Monoid.mempty(Data_Monoid.monoidArray));
var embed = function (xs) {
    return element(tagName("embed"))(xs);
};
var embed_ = embed(Data_Monoid.mempty(Data_Monoid.monoidArray));
var fieldset = function (xs) {
    return element(tagName("fieldset"))(xs);
};
var fieldset_ = fieldset(Data_Monoid.mempty(Data_Monoid.monoidArray));
var figcaption = function (xs) {
    return element(tagName("figcaption"))(xs);
};
var figcaption_ = figcaption(Data_Monoid.mempty(Data_Monoid.monoidArray));
var figure = function (xs) {
    return element(tagName("figure"))(xs);
};
var figure_ = figure(Data_Monoid.mempty(Data_Monoid.monoidArray));
var font = function (xs) {
    return element(tagName("font"))(xs);
};
var font_ = font(Data_Monoid.mempty(Data_Monoid.monoidArray));
var footer = function (xs) {
    return element(tagName("footer"))(xs);
};
var footer_ = footer(Data_Monoid.mempty(Data_Monoid.monoidArray));
var form = function (xs) {
    return element(tagName("form"))(xs);
};
var form_ = form(Data_Monoid.mempty(Data_Monoid.monoidArray));
var frame = function (xs) {
    return element(tagName("frame"))(xs);
};
var frame_ = frame(Data_Monoid.mempty(Data_Monoid.monoidArray));
var frameset = function (xs) {
    return element(tagName("frameset"))(xs);
};
var frameset_ = frameset(Data_Monoid.mempty(Data_Monoid.monoidArray));
var h1 = function (xs) {
    return element(tagName("h1"))(xs);
};
var h1_ = h1(Data_Monoid.mempty(Data_Monoid.monoidArray));
var h2 = function (xs) {
    return element(tagName("h2"))(xs);
};
var h2_ = h2(Data_Monoid.mempty(Data_Monoid.monoidArray));
var h3 = function (xs) {
    return element(tagName("h3"))(xs);
};
var h3_ = h3(Data_Monoid.mempty(Data_Monoid.monoidArray));
var h4 = function (xs) {
    return element(tagName("h4"))(xs);
};
var h4_ = h4(Data_Monoid.mempty(Data_Monoid.monoidArray));
var h5 = function (xs) {
    return element(tagName("h5"))(xs);
};
var h5_ = h5(Data_Monoid.mempty(Data_Monoid.monoidArray));
var h6 = function (xs) {
    return element(tagName("h6"))(xs);
};
var h6_ = h6(Data_Monoid.mempty(Data_Monoid.monoidArray));
var head = function (xs) {
    return element(tagName("head"))(xs);
};
var head_ = head(Data_Monoid.mempty(Data_Monoid.monoidArray));
var header = function (xs) {
    return element(tagName("header"))(xs);
};
var header_ = header(Data_Monoid.mempty(Data_Monoid.monoidArray));
var hr = function (xs) {
    return element(tagName("hr"))(xs);
};
var hr_ = hr(Data_Monoid.mempty(Data_Monoid.monoidArray));
var html = function (xs) {
    return element(tagName("html"))(xs);
};
var html_ = html(Data_Monoid.mempty(Data_Monoid.monoidArray));
var i = function (xs) {
    return element(tagName("i"))(xs);
};
var i_ = i(Data_Monoid.mempty(Data_Monoid.monoidArray));
var iframe = function (xs) {
    return element(tagName("iframe"))(xs);
};
var iframe_ = iframe(Data_Monoid.mempty(Data_Monoid.monoidArray));
var img = function (xs) {
    return element(tagName("img"))(xs);
};
var img_ = img(Data_Monoid.mempty(Data_Monoid.monoidArray));
var input = function (xs) {
    return element(tagName("input"))(xs);
};
var input_ = input(Data_Monoid.mempty(Data_Monoid.monoidArray));
var ins = function (xs) {
    return element(tagName("ins"))(xs);
};
var ins_ = ins(Data_Monoid.mempty(Data_Monoid.monoidArray));
var kbd = function (xs) {
    return element(tagName("kbd"))(xs);
};
var kbd_ = kbd(Data_Monoid.mempty(Data_Monoid.monoidArray));
var keygen = function (xs) {
    return element(tagName("keygen"))(xs);
};
var keygen_ = keygen(Data_Monoid.mempty(Data_Monoid.monoidArray));
var label = function (xs) {
    return element(tagName("label"))(xs);
};
var label_ = label(Data_Monoid.mempty(Data_Monoid.monoidArray));
var legend = function (xs) {
    return element(tagName("legend"))(xs);
};
var legend_ = legend(Data_Monoid.mempty(Data_Monoid.monoidArray));
var li = function (xs) {
    return element(tagName("li"))(xs);
};
var li_ = li(Data_Monoid.mempty(Data_Monoid.monoidArray));
var link = function (xs) {
    return element(tagName("link"))(xs);
};
var link_ = link(Data_Monoid.mempty(Data_Monoid.monoidArray));
var main = function (xs) {
    return element(tagName("main"))(xs);
};
var main_ = main(Data_Monoid.mempty(Data_Monoid.monoidArray));
var map = function (xs) {
    return element(tagName("map"))(xs);
};
var map_ = map(Data_Monoid.mempty(Data_Monoid.monoidArray));
var mark = function (xs) {
    return element(tagName("mark"))(xs);
};
var mark_ = mark(Data_Monoid.mempty(Data_Monoid.monoidArray));
var menu = function (xs) {
    return element(tagName("menu"))(xs);
};
var menu_ = menu(Data_Monoid.mempty(Data_Monoid.monoidArray));
var menuitem = function (xs) {
    return element(tagName("menuitem"))(xs);
};
var menuitem_ = menuitem(Data_Monoid.mempty(Data_Monoid.monoidArray));
var meta = function (xs) {
    return element(tagName("meta"))(xs);
};
var meta_ = meta(Data_Monoid.mempty(Data_Monoid.monoidArray));
var meter = function (xs) {
    return element(tagName("meter"))(xs);
};
var meter_ = meter(Data_Monoid.mempty(Data_Monoid.monoidArray));
var nav = function (xs) {
    return element(tagName("nav"))(xs);
};
var nav_ = nav(Data_Monoid.mempty(Data_Monoid.monoidArray));
var noframes = function (xs) {
    return element(tagName("noframes"))(xs);
};
var noframes_ = noframes(Data_Monoid.mempty(Data_Monoid.monoidArray));
var noscript = function (xs) {
    return element(tagName("noscript"))(xs);
};
var noscript_ = noscript(Data_Monoid.mempty(Data_Monoid.monoidArray));
var object = function (xs) {
    return element(tagName("object"))(xs);
};
var object_ = object(Data_Monoid.mempty(Data_Monoid.monoidArray));
var ol = function (xs) {
    return element(tagName("ol"))(xs);
};
var ol_ = ol(Data_Monoid.mempty(Data_Monoid.monoidArray));
var optgroup = function (xs) {
    return element(tagName("optgroup"))(xs);
};
var optgroup_ = optgroup(Data_Monoid.mempty(Data_Monoid.monoidArray));
var option = function (xs) {
    return element(tagName("option"))(xs);
};
var option_ = option(Data_Monoid.mempty(Data_Monoid.monoidArray));
var output = function (xs) {
    return element(tagName("output"))(xs);
};
var output_ = output(Data_Monoid.mempty(Data_Monoid.monoidArray));
var p = function (xs) {
    return element(tagName("p"))(xs);
};
var p_ = p(Data_Monoid.mempty(Data_Monoid.monoidArray));
var param = function (xs) {
    return element(tagName("param"))(xs);
};
var param_ = param(Data_Monoid.mempty(Data_Monoid.monoidArray));
var pre = function (xs) {
    return element(tagName("pre"))(xs);
};
var pre_ = pre(Data_Monoid.mempty(Data_Monoid.monoidArray));
var progress = function (xs) {
    return element(tagName("progress"))(xs);
};
var progress_ = progress(Data_Monoid.mempty(Data_Monoid.monoidArray));
var q = function (xs) {
    return element(tagName("q"))(xs);
};
var q_ = q(Data_Monoid.mempty(Data_Monoid.monoidArray));
var rp = function (xs) {
    return element(tagName("rp"))(xs);
};
var rp_ = rp(Data_Monoid.mempty(Data_Monoid.monoidArray));
var rt = function (xs) {
    return element(tagName("rt"))(xs);
};
var rt_ = rt(Data_Monoid.mempty(Data_Monoid.monoidArray));
var ruby = function (xs) {
    return element(tagName("ruby"))(xs);
};
var ruby_ = ruby(Data_Monoid.mempty(Data_Monoid.monoidArray));
var s = function (xs) {
    return element(tagName("s"))(xs);
};
var runTagName = function (_83) {
    return _83;
};
var s_ = s(Data_Monoid.mempty(Data_Monoid.monoidArray));
var samp = function (xs) {
    return element(tagName("samp"))(xs);
};
var samp_ = samp(Data_Monoid.mempty(Data_Monoid.monoidArray));
var script = function (xs) {
    return element(tagName("script"))(xs);
};
var script_ = script(Data_Monoid.mempty(Data_Monoid.monoidArray));
var section = function (xs) {
    return element(tagName("section"))(xs);
};
var section_ = section(Data_Monoid.mempty(Data_Monoid.monoidArray));
var select = function (xs) {
    return element(tagName("select"))(xs);
};
var select_ = select(Data_Monoid.mempty(Data_Monoid.monoidArray));
var small = function (xs) {
    return element(tagName("small"))(xs);
};
var small_ = small(Data_Monoid.mempty(Data_Monoid.monoidArray));
var source = function (xs) {
    return element(tagName("source"))(xs);
};
var source_ = source(Data_Monoid.mempty(Data_Monoid.monoidArray));
var span = function (xs) {
    return element(tagName("span"))(xs);
};
var span_ = span(Data_Monoid.mempty(Data_Monoid.monoidArray));
var strike = function (xs) {
    return element(tagName("strike"))(xs);
};
var strike_ = strike(Data_Monoid.mempty(Data_Monoid.monoidArray));
var strong = function (xs) {
    return element(tagName("strong"))(xs);
};
var strong_ = strong(Data_Monoid.mempty(Data_Monoid.monoidArray));
var style = function (xs) {
    return element(tagName("style"))(xs);
};
var style_ = style(Data_Monoid.mempty(Data_Monoid.monoidArray));
var sub = function (xs) {
    return element(tagName("sub"))(xs);
};
var sub_ = sub(Data_Monoid.mempty(Data_Monoid.monoidArray));
var summary = function (xs) {
    return element(tagName("summary"))(xs);
};
var summary_ = summary(Data_Monoid.mempty(Data_Monoid.monoidArray));
var sup = function (xs) {
    return element(tagName("sup"))(xs);
};
var sup_ = sup(Data_Monoid.mempty(Data_Monoid.monoidArray));
var table = function (xs) {
    return element(tagName("table"))(xs);
};
var table_ = table(Data_Monoid.mempty(Data_Monoid.monoidArray));
var tbody = function (xs) {
    return element(tagName("tbody"))(xs);
};
var tbody_ = tbody(Data_Monoid.mempty(Data_Monoid.monoidArray));
var td = function (xs) {
    return element(tagName("td"))(xs);
};
var td_ = td(Data_Monoid.mempty(Data_Monoid.monoidArray));
var textarea = function (xs) {
    return element(tagName("textarea"))(xs);
};
var textarea_ = textarea(Data_Monoid.mempty(Data_Monoid.monoidArray));
var tfoot = function (xs) {
    return element(tagName("tfoot"))(xs);
};
var tfoot_ = tfoot(Data_Monoid.mempty(Data_Monoid.monoidArray));
var th = function (xs) {
    return element(tagName("th"))(xs);
};
var th_ = th(Data_Monoid.mempty(Data_Monoid.monoidArray));
var thead = function (xs) {
    return element(tagName("thead"))(xs);
};
var thead_ = thead(Data_Monoid.mempty(Data_Monoid.monoidArray));
var time = function (xs) {
    return element(tagName("time"))(xs);
};
var time_ = time(Data_Monoid.mempty(Data_Monoid.monoidArray));
var title = function (xs) {
    return element(tagName("title"))(xs);
};
var title_ = title(Data_Monoid.mempty(Data_Monoid.monoidArray));
var tr = function (xs) {
    return element(tagName("tr"))(xs);
};
var tr_ = tr(Data_Monoid.mempty(Data_Monoid.monoidArray));
var track = function (xs) {
    return element(tagName("track"))(xs);
};
var track_ = track(Data_Monoid.mempty(Data_Monoid.monoidArray));
var tt = function (xs) {
    return element(tagName("tt"))(xs);
};
var tt_ = tt(Data_Monoid.mempty(Data_Monoid.monoidArray));
var u = function (xs) {
    return element(tagName("u"))(xs);
};
var u_ = u(Data_Monoid.mempty(Data_Monoid.monoidArray));
var ul = function (xs) {
    return element(tagName("ul"))(xs);
};
var ul_ = ul(Data_Monoid.mempty(Data_Monoid.monoidArray));
var $$var = function (xs) {
    return element(tagName("var"))(xs);
};
var var_ = $$var(Data_Monoid.mempty(Data_Monoid.monoidArray));
var video = function (xs) {
    return element(tagName("video"))(xs);
};
var video_ = video(Data_Monoid.mempty(Data_Monoid.monoidArray));
var wbr = function (xs) {
    return element(tagName("wbr"))(xs);
};
var wbr_ = wbr(Data_Monoid.mempty(Data_Monoid.monoidArray));
var dt = function (xs) {
    return element(tagName("dt"))(xs);
};
var dt_ = dt(Data_Monoid.mempty(Data_Monoid.monoidArray));
var dl = function (xs) {
    return element(tagName("dl"))(xs);
};
var dl_ = dl(Data_Monoid.mempty(Data_Monoid.monoidArray));
var div = function (xs) {
    return element(tagName("div"))(xs);
};
var div_ = div(Data_Monoid.mempty(Data_Monoid.monoidArray));
var dir = function (xs) {
    return element(tagName("dir"))(xs);
};
var dir_ = dir(Data_Monoid.mempty(Data_Monoid.monoidArray));
var dialog = function (xs) {
    return element(tagName("dialog"))(xs);
};
var dialog_ = dialog(Data_Monoid.mempty(Data_Monoid.monoidArray));
var dfn = function (xs) {
    return element(tagName("dfn"))(xs);
};
var dfn_ = dfn(Data_Monoid.mempty(Data_Monoid.monoidArray));
var details = function (xs) {
    return element(tagName("details"))(xs);
};
var details_ = details(Data_Monoid.mempty(Data_Monoid.monoidArray));
var del = function (xs) {
    return element(tagName("del"))(xs);
};
var del_ = del(Data_Monoid.mempty(Data_Monoid.monoidArray));
var dd = function (xs) {
    return element(tagName("dd"))(xs);
};
var dd_ = dd(Data_Monoid.mempty(Data_Monoid.monoidArray));
var datalist = function (xs) {
    return element(tagName("datalist"))(xs);
};
var datalist_ = datalist(Data_Monoid.mempty(Data_Monoid.monoidArray));
var colgroup = function (xs) {
    return element(tagName("colgroup"))(xs);
};
var colgroup_ = colgroup(Data_Monoid.mempty(Data_Monoid.monoidArray));
var col = function (xs) {
    return element(tagName("col"))(xs);
};
var col_ = col(Data_Monoid.mempty(Data_Monoid.monoidArray));
var code = function (xs) {
    return element(tagName("code"))(xs);
};
var code_ = code(Data_Monoid.mempty(Data_Monoid.monoidArray));
var cite = function (xs) {
    return element(tagName("cite"))(xs);
};
var cite_ = cite(Data_Monoid.mempty(Data_Monoid.monoidArray));
var center = function (xs) {
    return element(tagName("center"))(xs);
};
var center_ = center(Data_Monoid.mempty(Data_Monoid.monoidArray));
var caption = function (xs) {
    return element(tagName("caption"))(xs);
};
var caption_ = caption(Data_Monoid.mempty(Data_Monoid.monoidArray));
var canvas = function (xs) {
    return element(tagName("canvas"))(xs);
};
var canvas_ = canvas(Data_Monoid.mempty(Data_Monoid.monoidArray));
var button = function (xs) {
    return element(tagName("button"))(xs);
};
var button_ = button(Data_Monoid.mempty(Data_Monoid.monoidArray));
var br = function (xs) {
    return element(tagName("br"))(xs);
};
var br_ = br(Data_Monoid.mempty(Data_Monoid.monoidArray));
var body = function (xs) {
    return element(tagName("body"))(xs);
};
var body_ = body(Data_Monoid.mempty(Data_Monoid.monoidArray));
var blockquote = function (xs) {
    return element(tagName("blockquote"))(xs);
};
var blockquote_ = blockquote(Data_Monoid.mempty(Data_Monoid.monoidArray));
var big = function (xs) {
    return element(tagName("big"))(xs);
};
var big_ = big(Data_Monoid.mempty(Data_Monoid.monoidArray));
var bifunctorHTML = new Data_Bifunctor.Bifunctor(function (f) {
    return function (g) {
        var go = function (_85) {
            if (_85 instanceof Text) {
                return new Text(_85.value0);
            };
            if (_85 instanceof Element) {
                return new Element(_85.value0, Prelude["<$>"](Data_Array.functorArray)(Prelude["<$>"](Halogen_HTML_Attributes.functorAttr)(g))(_85.value1), Prelude["<$>"](Data_Array.functorArray)(go)(_85.value2));
            };
            if (_85 instanceof Placeholder) {
                return new Placeholder(f(_85.value0));
            };
            throw new Error("Failed pattern match");
        };
        return go;
    };
});
var functorHTML = new Prelude.Functor(Data_Bifunctor.rmap(bifunctorHTML));
var bdo = function (xs) {
    return element(tagName("bdo"))(xs);
};
var bdo_ = bdo(Data_Monoid.mempty(Data_Monoid.monoidArray));
var bdi = function (xs) {
    return element(tagName("bdi"))(xs);
};
var bdi_ = bdi(Data_Monoid.mempty(Data_Monoid.monoidArray));
var basefont = function (xs) {
    return element(tagName("basefont"))(xs);
};
var basefont_ = basefont(Data_Monoid.mempty(Data_Monoid.monoidArray));
var base = function (xs) {
    return element(tagName("base"))(xs);
};
var base_ = base(Data_Monoid.mempty(Data_Monoid.monoidArray));
var b = function (xs) {
    return element(tagName("b"))(xs);
};
var b_ = b(Data_Monoid.mempty(Data_Monoid.monoidArray));
var audio = function (xs) {
    return element(tagName("audio"))(xs);
};
var audio_ = audio(Data_Monoid.mempty(Data_Monoid.monoidArray));
var aside = function (xs) {
    return element(tagName("aside"))(xs);
};
var aside_ = aside(Data_Monoid.mempty(Data_Monoid.monoidArray));
var article = function (xs) {
    return element(tagName("article"))(xs);
};
var article_ = article(Data_Monoid.mempty(Data_Monoid.monoidArray));
var area = function (xs) {
    return element(tagName("area"))(xs);
};
var area_ = area(Data_Monoid.mempty(Data_Monoid.monoidArray));
var applet = function (xs) {
    return element(tagName("applet"))(xs);
};
var applet_ = applet(Data_Monoid.mempty(Data_Monoid.monoidArray));
var address = function (xs) {
    return element(tagName("address"))(xs);
};
var address_ = address(Data_Monoid.mempty(Data_Monoid.monoidArray));
var acronym = function (xs) {
    return element(tagName("acronym"))(xs);
};
var acronym_ = acronym(Data_Monoid.mempty(Data_Monoid.monoidArray));
var abbr = function (xs) {
    return element(tagName("abbr"))(xs);
};
var abbr_ = abbr(Data_Monoid.mempty(Data_Monoid.monoidArray));
var a = function (xs) {
    return element(tagName("a"))(xs);
};
var a_ = a(Data_Monoid.mempty(Data_Monoid.monoidArray));
var graft = function (_84) {
    return function (f) {
        if (_84 instanceof Placeholder) {
            return f(_84.value0);
        };
        if (_84 instanceof Element) {
            return new Element(_84.value0, _84.value1, Prelude["<$>"](Data_Array.functorArray)(function (_0) {
                return graft(_0)(f);
            })(_84.value2));
        };
        if (_84 instanceof Text) {
            return new Text(_84.value0);
        };
        throw new Error("Failed pattern match");
    };
};
module.exports = {
    Text: Text, 
    Element: Element, 
    Placeholder: Placeholder, 
    wbr_: wbr_, 
    wbr: wbr, 
    video_: video_, 
    video: video, 
    var_: var_, 
    "var": $$var, 
    ul_: ul_, 
    ul: ul, 
    u_: u_, 
    u: u, 
    tt_: tt_, 
    tt: tt, 
    track_: track_, 
    track: track, 
    tr_: tr_, 
    tr: tr, 
    title_: title_, 
    title: title, 
    time_: time_, 
    time: time, 
    thead_: thead_, 
    thead: thead, 
    th_: th_, 
    th: th, 
    tfoot_: tfoot_, 
    tfoot: tfoot, 
    textarea_: textarea_, 
    textarea: textarea, 
    td_: td_, 
    td: td, 
    tbody_: tbody_, 
    tbody: tbody, 
    table_: table_, 
    table: table, 
    sup_: sup_, 
    sup: sup, 
    summary_: summary_, 
    summary: summary, 
    sub_: sub_, 
    sub: sub, 
    style_: style_, 
    style: style, 
    strong_: strong_, 
    strong: strong, 
    strike_: strike_, 
    strike: strike, 
    span_: span_, 
    span: span, 
    source_: source_, 
    source: source, 
    small_: small_, 
    small: small, 
    select_: select_, 
    select: select, 
    section_: section_, 
    section: section, 
    script_: script_, 
    script: script, 
    samp_: samp_, 
    samp: samp, 
    s_: s_, 
    s: s, 
    ruby_: ruby_, 
    ruby: ruby, 
    rt_: rt_, 
    rt: rt, 
    rp_: rp_, 
    rp: rp, 
    q_: q_, 
    q: q, 
    progress_: progress_, 
    progress: progress, 
    pre_: pre_, 
    pre: pre, 
    param_: param_, 
    param: param, 
    p_: p_, 
    p: p, 
    output_: output_, 
    output: output, 
    option_: option_, 
    option: option, 
    optgroup_: optgroup_, 
    optgroup: optgroup, 
    ol_: ol_, 
    ol: ol, 
    object_: object_, 
    object: object, 
    noscript_: noscript_, 
    noscript: noscript, 
    noframes_: noframes_, 
    noframes: noframes, 
    nav_: nav_, 
    nav: nav, 
    meter_: meter_, 
    meter: meter, 
    meta_: meta_, 
    meta: meta, 
    menuitem_: menuitem_, 
    menuitem: menuitem, 
    menu_: menu_, 
    menu: menu, 
    mark_: mark_, 
    mark: mark, 
    map_: map_, 
    map: map, 
    main_: main_, 
    main: main, 
    link_: link_, 
    link: link, 
    li_: li_, 
    li: li, 
    legend_: legend_, 
    legend: legend, 
    label_: label_, 
    label: label, 
    keygen_: keygen_, 
    keygen: keygen, 
    kbd_: kbd_, 
    kbd: kbd, 
    ins_: ins_, 
    ins: ins, 
    input_: input_, 
    input: input, 
    img_: img_, 
    img: img, 
    iframe_: iframe_, 
    iframe: iframe, 
    i_: i_, 
    i: i, 
    html_: html_, 
    html: html, 
    hr_: hr_, 
    hr: hr, 
    header_: header_, 
    header: header, 
    head_: head_, 
    head: head, 
    h6_: h6_, 
    h6: h6, 
    h5_: h5_, 
    h5: h5, 
    h4_: h4_, 
    h4: h4, 
    h3_: h3_, 
    h3: h3, 
    h2_: h2_, 
    h2: h2, 
    h1_: h1_, 
    h1: h1, 
    frameset_: frameset_, 
    frameset: frameset, 
    frame_: frame_, 
    frame: frame, 
    form_: form_, 
    form: form, 
    footer_: footer_, 
    footer: footer, 
    font_: font_, 
    font: font, 
    figure_: figure_, 
    figure: figure, 
    figcaption_: figcaption_, 
    figcaption: figcaption, 
    fieldset_: fieldset_, 
    fieldset: fieldset, 
    embed_: embed_, 
    embed: embed, 
    em_: em_, 
    em: em, 
    dt_: dt_, 
    dt: dt, 
    dl_: dl_, 
    dl: dl, 
    div_: div_, 
    div: div, 
    dir_: dir_, 
    dir: dir, 
    dialog_: dialog_, 
    dialog: dialog, 
    dfn_: dfn_, 
    dfn: dfn, 
    details_: details_, 
    details: details, 
    del_: del_, 
    del: del, 
    dd_: dd_, 
    dd: dd, 
    datalist_: datalist_, 
    datalist: datalist, 
    colgroup_: colgroup_, 
    colgroup: colgroup, 
    col_: col_, 
    col: col, 
    code_: code_, 
    code: code, 
    cite_: cite_, 
    cite: cite, 
    center_: center_, 
    center: center, 
    caption_: caption_, 
    caption: caption, 
    canvas_: canvas_, 
    canvas: canvas, 
    button_: button_, 
    button: button, 
    br_: br_, 
    br: br, 
    body_: body_, 
    body: body, 
    blockquote_: blockquote_, 
    blockquote: blockquote, 
    big_: big_, 
    big: big, 
    bdo_: bdo_, 
    bdo: bdo, 
    bdi_: bdi_, 
    bdi: bdi, 
    basefont_: basefont_, 
    basefont: basefont, 
    base_: base_, 
    base: base, 
    b_: b_, 
    b: b, 
    audio_: audio_, 
    audio: audio, 
    aside_: aside_, 
    aside: aside, 
    article_: article_, 
    article: article, 
    area_: area_, 
    area: area, 
    applet_: applet_, 
    applet: applet, 
    address_: address_, 
    address: address, 
    acronym_: acronym_, 
    acronym: acronym, 
    abbr_: abbr_, 
    abbr: abbr, 
    a_: a_, 
    a: a, 
    runTagName: runTagName, 
    tagName: tagName, 
    graft: graft, 
    element: element, 
    placeholder: placeholder, 
    text: text, 
    bifunctorHTML: bifunctorHTML, 
    functorHTML: functorHTML
};

},{"Control.Monad.Eff":40,"Control.Monad.Eff.Unsafe":39,"Control.Monad.ST":50,"Data.Array":61,"Data.Bifunctor":62,"Data.Foldable":76,"Data.Foreign":82,"Data.Function":83,"Data.Maybe":89,"Data.Monoid":96,"Data.StrMap":103,"Data.String":106,"Data.Tuple":108,"Data.Void":111,"Halogen.HTML.Attributes":115,"Halogen.Internal.VirtualDOM":123,"Prelude":130}],123:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Function = require("Data.Function");
var Prelude = require("Prelude");
var DOM = require("DOM");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");
var Data_Int = require("Data.Int");
var Data_Maybe = require("Data.Maybe");
var Data_Monoid = require("Data.Monoid");
var Data_Nullable = require("Data.Nullable");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Control_Monad_ST = require("Control.Monad.ST");
var emptyProps = {};
function prop(key, value) {  var props = {};  props[key] = value;  return props;};
function handlerProp(key, f) {  var props = {};  var Hook = function () {};  Hook.prototype.callback = function(e) {    f(e)();  };  Hook.prototype.hook = function(node) {    node.addEventListener(key, this.callback);  };  Hook.prototype.unhook = function(node) {    node.removeEventListener(key, this.callback);  };  props['halogen-hook-' + key] = new Hook(f);  return props;};
function initProp(f) {  var props = {};  var Hook = function () {};  Hook.prototype.hook = function(node, prop, prev) {    if (typeof prev === 'undefined') {      f();    };  };  props['halogen-init'] = new Hook(f);  return props;};
function finalizerProp(f) {  var props = {};  var Hook = function () {};  Hook.prototype.hook = function() { };  Hook.prototype.unhook = function() {    f();  };  props['halogen-finalizer'] = new Hook(f);  return props;};
function concatProps(p1, p2) {  var props = {};  for (var key in p1) {    props[key] = p1[key];  }  for (var key in p2) {    props[key] = p2[key];  }  return props;};
function createElement(vtree) {  return require('virtual-dom/create-element')(vtree);};
function diff(vtree1) {  return function createElement(vtree2) {    return require('virtual-dom/diff')(vtree1, vtree2);  };};
function patch(p) {  return function(node) {    return function() {      return require('virtual-dom/patch')(node, p);    };  };};
function vtext(s) {  var VText = require('virtual-dom/vnode/vtext');  return new VText(s);};
function vnode(name) {  return function(attr) {    return function(children) {      var VirtualNode = require('virtual-dom/vnode/vnode');      var props = {        attributes: {}      };      for (var key in attr) {        if ((key.indexOf('data-') === 0) || (key === 'readonly')) {          props.attributes[key] = attr[key];        } else {          props[key] = attr[key];        }      }      return new VirtualNode(name, props, children);    };  };};
var semigroupProps = new Prelude.Semigroup(Data_Function.runFn2(concatProps));
var monoidProps = new Data_Monoid.Monoid(function () {
    return semigroupProps;
}, emptyProps);
module.exports = {
    vnode: vnode, 
    vtext: vtext, 
    patch: patch, 
    diff: diff, 
    createElement: createElement, 
    finalizerProp: finalizerProp, 
    initProp: initProp, 
    handlerProp: handlerProp, 
    prop: prop, 
    emptyProps: emptyProps, 
    semigroupProps: semigroupProps, 
    monoidProps: monoidProps
};

},{"Control.Monad.Eff":40,"Control.Monad.ST":50,"DOM":59,"Data.DOM.Simple.Types":68,"Data.Function":83,"Data.Int":86,"Data.Maybe":89,"Data.Monoid":96,"Data.Nullable":97,"Prelude":130,"virtual-dom/create-element":2,"virtual-dom/diff":3,"virtual-dom/patch":7,"virtual-dom/vnode/vnode":21,"virtual-dom/vnode/vtext":23}],124:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_Tuple = require("Data.Tuple");
var Prelude = require("Prelude");
var Data_Profunctor = require("Data.Profunctor");
var Data_Profunctor_Strong = require("Data.Profunctor.Strong");
var Data_Profunctor_Choice = require("Data.Profunctor.Choice");
var Data_Either = require("Data.Either");
var SF = function (x) {
    return x;
};
var SF1 = function (x) {
    return x;
};
var tail = function (_33) {
    return _33.next;
};
var stateful$prime = function (s) {
    return function (step) {
        var go = function (s_1) {
            return function (i) {
                var _158 = step(s_1)(i);
                return {
                    result: _158.value0, 
                    next: go(_158.value1)
                };
            };
        };
        return go(s);
    };
};
var startingAt = function (s) {
    return function (o) {
        return {
            result: o, 
            next: s
        };
    };
};
var stateful = function (s) {
    return function (step) {
        return startingAt(stateful$prime(s)(function (s_1) {
            return function (i) {
                var s$prime = step(s_1)(i);
                return new Data_Tuple.Tuple(s$prime, s$prime);
            };
        }))(s);
    };
};
var runSF1 = function (_31) {
    return _31;
};
var runSF = function (_30) {
    return _30;
};
var profunctorSF1 = new Data_Profunctor.Profunctor(function (f) {
    return function (g) {
        return function (_39) {
            return {
                result: g(_39.result), 
                next: Data_Profunctor.dimap(profunctorSF)(f)(g)(_39.next)
            };
        };
    };
});
var profunctorSF = new Data_Profunctor.Profunctor(function (f) {
    return function (g) {
        return function (_38) {
            return function (i) {
                return Data_Profunctor.dimap(profunctorSF1)(f)(g)(_38(f(i)));
            };
        };
    };
});
var strongSF = new Data_Profunctor_Strong.Strong(function () {
    return profunctorSF;
}, function (s) {
    return function (_28) {
        var _170 = runSF(s)(_28.value0);
        return {
            result: new Data_Tuple.Tuple(_170.result, _28.value1), 
            next: Data_Profunctor_Strong.first(strongSF)(_170.next)
        };
    };
}, function (s) {
    return function (_29) {
        var _174 = runSF(s)(_29.value1);
        return {
            result: new Data_Tuple.Tuple(_29.value0, _174.result), 
            next: Data_Profunctor_Strong.second(strongSF)(_174.next)
        };
    };
});
var loop = function (s) {
    return function (signal) {
        return function (i) {
            var _177 = runSF(signal)(new Data_Tuple.Tuple(s, i));
            return {
                result: Data_Tuple.snd(_177.result), 
                next: loop(Data_Tuple.fst(_177.result))(_177.next)
            };
        };
    };
};
var input = function (i) {
    return {
        result: i, 
        next: input
    };
};
var head = function (_32) {
    return _32.result;
};
var mergeWith$prime = function (f) {
    return function (g) {
        var o = function (s1) {
            return function (s2) {
                return {
                    result: g(head(s1))(head(s2)), 
                    next: function (i) {
                        var _179 = f(i);
                        if (_179 instanceof Data_Either.Left) {
                            return o(runSF(tail(s1))(_179.value0))(s2);
                        };
                        if (_179 instanceof Data_Either.Right) {
                            return o(s1)(runSF(tail(s2))(_179.value0));
                        };
                        throw new Error("Failed pattern match");
                    }
                };
            };
        };
        return o;
    };
};
var mergeWith = mergeWith$prime(Prelude.id(Prelude.categoryArr));
var semigroupoidSF1 = new Prelude.Semigroupoid(function (f) {
    return function (g) {
        return {
            result: head(f), 
            next: Prelude["<<<"](semigroupoidSF)(tail(f))(tail(g))
        };
    };
});
var semigroupoidSF = new Prelude.Semigroupoid(function (f) {
    return function (g) {
        return function (i) {
            var s1 = runSF(g)(i);
            var s2 = runSF(f)(head(s1));
            return Prelude["<<<"](semigroupoidSF1)(s2)(s1);
        };
    };
});
var functorSF1 = new Prelude.Functor(function (f) {
    return function (_35) {
        return {
            result: f(_35.result), 
            next: Prelude["<$>"](functorSF)(f)(_35.next)
        };
    };
});
var functorSF = new Prelude.Functor(function (f) {
    return function (_34) {
        return function (i) {
            return Prelude["<$>"](functorSF1)(f)(_34(i));
        };
    };
});
var differencesWith = function (f) {
    return function (initial) {
        return stateful$prime(initial)(function (last) {
            return function (next) {
                var d = f(last)(next);
                return new Data_Tuple.Tuple(d, next);
            };
        });
    };
};
var choiceSF = new Data_Profunctor_Choice.Choice(function () {
    return profunctorSF;
}, function (s) {
    return function (e) {
        if (e instanceof Data_Either.Left) {
            var _187 = runSF(s)(e.value0);
            return {
                result: new Data_Either.Left(_187.result), 
                next: Data_Profunctor_Choice.left(choiceSF)(_187.next)
            };
        };
        if (e instanceof Data_Either.Right) {
            return {
                result: new Data_Either.Right(e.value0), 
                next: Data_Profunctor_Choice.left(choiceSF)(s)
            };
        };
        throw new Error("Failed pattern match");
    };
}, function (s) {
    return function (e) {
        if (e instanceof Data_Either.Left) {
            return {
                result: new Data_Either.Left(e.value0), 
                next: Data_Profunctor_Choice.right(choiceSF)(s)
            };
        };
        if (e instanceof Data_Either.Right) {
            var _192 = runSF(s)(e.value0);
            return {
                result: new Data_Either.Right(_192.result), 
                next: Data_Profunctor_Choice.right(choiceSF)(_192.next)
            };
        };
        throw new Error("Failed pattern match");
    };
});
var categorySF = new Prelude.Category(function () {
    return semigroupoidSF;
}, input);
var applySF1 = new Prelude.Apply(function (_36) {
    return function (_37) {
        return {
            result: _36.result(_37.result), 
            next: Prelude["<*>"](applySF)(_36.next)(_37.next)
        };
    };
}, function () {
    return functorSF1;
});
var applySF = new Prelude.Apply(function (f) {
    return function (x) {
        return function (i) {
            return Prelude["<*>"](applySF1)(runSF(f)(i))(runSF(x)(i));
        };
    };
}, function () {
    return functorSF;
});
var applicativeSF1 = new Prelude.Applicative(function () {
    return applySF1;
}, function (a) {
    return {
        result: a, 
        next: Prelude.pure(applicativeSF)(a)
    };
});
var applicativeSF = new Prelude.Applicative(function () {
    return applySF;
}, function (a) {
    return function (_27) {
        return Prelude.pure(applicativeSF1)(a);
    };
});
module.exports = {
    "mergeWith'": mergeWith$prime, 
    mergeWith: mergeWith, 
    tail: tail, 
    head: head, 
    startingAt: startingAt, 
    loop: loop, 
    differencesWith: differencesWith, 
    "stateful'": stateful$prime, 
    stateful: stateful, 
    input: input, 
    runSF1: runSF1, 
    runSF: runSF, 
    functorSF: functorSF, 
    functorSF1: functorSF1, 
    applySF: applySF, 
    applySF1: applySF1, 
    applicativeSF: applicativeSF, 
    applicativeSF1: applicativeSF1, 
    profunctorSF: profunctorSF, 
    profunctorSF1: profunctorSF1, 
    strongSF: strongSF, 
    choiceSF: choiceSF, 
    semigroupoidSF: semigroupoidSF, 
    semigroupoidSF1: semigroupoidSF1, 
    categorySF: categorySF
};

},{"Data.Either":74,"Data.Profunctor":100,"Data.Profunctor.Choice":98,"Data.Profunctor.Strong":99,"Data.Tuple":108,"Prelude":130}],125:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Halogen_HTML = require("Halogen.HTML");
var Halogen_HTML_Attributes = require("Halogen.HTML.Attributes");
var Halogen_Themes_Bootstrap3 = require("Halogen.Themes.Bootstrap3");
var Prelude = require("Prelude");
var Data_Foldable = require("Data.Foldable");
var Data_Maybe = require("Data.Maybe");
var Data_Array = require("Data.Array");
var Data_Monoid = require("Data.Monoid");
var RegularAddOn = (function () {
    function RegularAddOn(value0) {
        this.value0 = value0;
    };
    RegularAddOn.create = function (value0) {
        return new RegularAddOn(value0);
    };
    return RegularAddOn;
})();
var ButtonAddOn = (function () {
    function ButtonAddOn(value0) {
        this.value0 = value0;
    };
    ButtonAddOn.create = function (value0) {
        return new ButtonAddOn(value0);
    };
    return ButtonAddOn;
})();
var inputGroup = function (before) {
    return function (ctl) {
        return function (after) {
            var addon = function (_731) {
                if (_731 instanceof RegularAddOn) {
                    return [ Halogen_HTML.span([ Halogen_HTML_Attributes.class_(Halogen_Themes_Bootstrap3.inputGroupAddon) ])([ _731.value0 ]) ];
                };
                if (_731 instanceof ButtonAddOn) {
                    return [ Halogen_HTML.span([ Halogen_HTML_Attributes.class_(Halogen_Themes_Bootstrap3.inputGroupBtn) ])([ _731.value0 ]) ];
                };
                throw new Error("Failed pattern match");
            };
            return Halogen_HTML.div([ Halogen_HTML_Attributes.class_(Halogen_Themes_Bootstrap3.inputGroup) ])(Prelude["++"](Data_Array.semigroupArray)(Data_Foldable.foldMap(Data_Foldable.foldableMaybe)(Data_Monoid.monoidArray)(addon)(before))(Prelude["++"](Data_Array.semigroupArray)([ ctl ])(Data_Foldable.foldMap(Data_Foldable.foldableMaybe)(Data_Monoid.monoidArray)(addon)(after))));
        };
    };
};
module.exports = {
    RegularAddOn: RegularAddOn, 
    ButtonAddOn: ButtonAddOn, 
    inputGroup: inputGroup
};

},{"Data.Array":61,"Data.Foldable":76,"Data.Maybe":89,"Data.Monoid":96,"Halogen.HTML":122,"Halogen.HTML.Attributes":115,"Halogen.Themes.Bootstrap3":126,"Prelude":130}],126:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Halogen_HTML_Attributes = require("Halogen.HTML.Attributes");
var Prelude = require("Prelude");
var woff2 = Halogen_HTML_Attributes.className("woff2");
var woff = Halogen_HTML_Attributes.className("woff");
var wellSm = Halogen_HTML_Attributes.className("well-sm");
var wellLg = Halogen_HTML_Attributes.className("well-lg");
var well = Halogen_HTML_Attributes.className("well");
var warning = Halogen_HTML_Attributes.className("warning");
var visibleXsInlineBlock = Halogen_HTML_Attributes.className("visible-xs-inline-block");
var visibleXsInline = Halogen_HTML_Attributes.className("visible-xs-inline");
var visibleXsBlock = Halogen_HTML_Attributes.className("visible-xs-block");
var visibleXs = Halogen_HTML_Attributes.className("visible-xs");
var visibleSmInlineBlock = Halogen_HTML_Attributes.className("visible-sm-inline-block");
var visibleSmInline = Halogen_HTML_Attributes.className("visible-sm-inline");
var visibleSmBlock = Halogen_HTML_Attributes.className("visible-sm-block");
var visibleSm = Halogen_HTML_Attributes.className("visible-sm");
var visiblePrintInlineBlock = Halogen_HTML_Attributes.className("visible-print-inline-block");
var visiblePrintInline = Halogen_HTML_Attributes.className("visible-print-inline");
var visiblePrintBlock = Halogen_HTML_Attributes.className("visible-print-block");
var visiblePrint = Halogen_HTML_Attributes.className("visible-print");
var visibleMdInlineBlock = Halogen_HTML_Attributes.className("visible-md-inline-block");
var visibleMdInline = Halogen_HTML_Attributes.className("visible-md-inline");
var visibleMdBlock = Halogen_HTML_Attributes.className("visible-md-block");
var visibleMd = Halogen_HTML_Attributes.className("visible-md");
var visibleLgInlineBlock = Halogen_HTML_Attributes.className("visible-lg-inline-block");
var visibleLgInline = Halogen_HTML_Attributes.className("visible-lg-inline");
var visibleLgBlock = Halogen_HTML_Attributes.className("visible-lg-block");
var visibleLg = Halogen_HTML_Attributes.className("visible-lg");
var ttf = Halogen_HTML_Attributes.className("ttf");
var topRight = Halogen_HTML_Attributes.className("top-right");
var topLeft = Halogen_HTML_Attributes.className("top-left");
var top = Halogen_HTML_Attributes.className("top");
var tooltipInner = Halogen_HTML_Attributes.className("tooltip-inner");
var tooltipArrow = Halogen_HTML_Attributes.className("tooltip-arrow");
var tooltip = Halogen_HTML_Attributes.className("tooltip");
var thumbnail = Halogen_HTML_Attributes.className("thumbnail");
var textWarning = Halogen_HTML_Attributes.className("text-warning");
var textUppercase = Halogen_HTML_Attributes.className("text-uppercase");
var textSuccess = Halogen_HTML_Attributes.className("text-success");
var textRight = Halogen_HTML_Attributes.className("text-right");
var textPrimary = Halogen_HTML_Attributes.className("text-primary");
var textNowrap = Halogen_HTML_Attributes.className("text-nowrap");
var textMuted = Halogen_HTML_Attributes.className("text-muted");
var textLowercase = Halogen_HTML_Attributes.className("text-lowercase");
var textLeft = Halogen_HTML_Attributes.className("text-left");
var textJustify = Halogen_HTML_Attributes.className("text-justify");
var textInfo = Halogen_HTML_Attributes.className("text-info");
var textHide = Halogen_HTML_Attributes.className("text-hide");
var textDanger = Halogen_HTML_Attributes.className("text-danger");
var textCenter = Halogen_HTML_Attributes.className("text-center");
var textCapitalize = Halogen_HTML_Attributes.className("text-capitalize");
var tableStriped = Halogen_HTML_Attributes.className("table-striped");
var tableResponsive = Halogen_HTML_Attributes.className("table-responsive");
var tableHover = Halogen_HTML_Attributes.className("table-hover");
var tableCondensed = Halogen_HTML_Attributes.className("table-condensed");
var tableBordered = Halogen_HTML_Attributes.className("table-bordered");
var table = Halogen_HTML_Attributes.className("table");
var tabPane = Halogen_HTML_Attributes.className("tab-pane");
var tabContent = Halogen_HTML_Attributes.className("tab-content");
var svg = Halogen_HTML_Attributes.className("svg");
var success = Halogen_HTML_Attributes.className("success");
var srOnlyFocusable = Halogen_HTML_Attributes.className("sr-only-focusable");
var srOnly = Halogen_HTML_Attributes.className("sr-only");
var small = Halogen_HTML_Attributes.className("small");
var show_ = Halogen_HTML_Attributes.className("show");
var row = Halogen_HTML_Attributes.className("row");
var right = Halogen_HTML_Attributes.className("right");
var radioInline = Halogen_HTML_Attributes.className("radio-inline");
var radio = Halogen_HTML_Attributes.className("radio");
var pullRight = Halogen_HTML_Attributes.className("pull-right");
var pullLeft = Halogen_HTML_Attributes.className("pull-left");
var progressStriped = Halogen_HTML_Attributes.className("progress-striped");
var progressBarWarning = Halogen_HTML_Attributes.className("progress-bar-warning");
var progressBarSuccess = Halogen_HTML_Attributes.className("progress-bar-success");
var progressBarStriped = Halogen_HTML_Attributes.className("progress-bar-striped");
var progressBarInfo = Halogen_HTML_Attributes.className("progress-bar-info");
var progressBarDanger = Halogen_HTML_Attributes.className("progress-bar-danger");
var progressBar = Halogen_HTML_Attributes.className("progress-bar");
var progress = Halogen_HTML_Attributes.className("progress");
var previous = Halogen_HTML_Attributes.className("previous");
var prev = Halogen_HTML_Attributes.className("prev");
var preScrollable = Halogen_HTML_Attributes.className("pre-scrollable");
var popoverTitle = Halogen_HTML_Attributes.className("popover-title");
var popoverContent = Halogen_HTML_Attributes.className("popover-content");
var popover = Halogen_HTML_Attributes.className("popover");
var panelWarning = Halogen_HTML_Attributes.className("panel-warning");
var panelTitle = Halogen_HTML_Attributes.className("panel-title");
var panelSuccess = Halogen_HTML_Attributes.className("panel-success");
var panelPrimary = Halogen_HTML_Attributes.className("panel-primary");
var panelInfo = Halogen_HTML_Attributes.className("panel-info");
var panelHeading = Halogen_HTML_Attributes.className("panel-heading");
var panelGroup = Halogen_HTML_Attributes.className("panel-group");
var panelFooter = Halogen_HTML_Attributes.className("panel-footer");
var panelDefault = Halogen_HTML_Attributes.className("panel-default");
var panelDanger = Halogen_HTML_Attributes.className("panel-danger");
var panelCollapse = Halogen_HTML_Attributes.className("panel-collapse");
var panelBody = Halogen_HTML_Attributes.className("panel-body");
var panel = Halogen_HTML_Attributes.className("panel");
var paginationSm = Halogen_HTML_Attributes.className("pagination-sm");
var paginationLg = Halogen_HTML_Attributes.className("pagination-lg");
var pagination = Halogen_HTML_Attributes.className("pagination");
var pager = Halogen_HTML_Attributes.className("pager");
var pageHeader = Halogen_HTML_Attributes.className("page-header");
var open = Halogen_HTML_Attributes.className("open");
var next = Halogen_HTML_Attributes.className("next");
var navbarToggle = Halogen_HTML_Attributes.className("navbar-toggle");
var navbarText = Halogen_HTML_Attributes.className("navbar-text");
var navbarStaticTop = Halogen_HTML_Attributes.className("navbar-static-top");
var navbarRight = Halogen_HTML_Attributes.className("navbar-right");
var navbarNav = Halogen_HTML_Attributes.className("navbar-nav");
var navbarLink = Halogen_HTML_Attributes.className("navbar-link");
var navbarLeft = Halogen_HTML_Attributes.className("navbar-left");
var navbarInverse = Halogen_HTML_Attributes.className("navbar-inverse");
var navbarHeader = Halogen_HTML_Attributes.className("navbar-header");
var navbarForm = Halogen_HTML_Attributes.className("navbar-form");
var navbarFixedTop = Halogen_HTML_Attributes.className("navbar-fixed-top");
var navbarFixedBottom = Halogen_HTML_Attributes.className("navbar-fixed-bottom");
var navbarDefault = Halogen_HTML_Attributes.className("navbar-default");
var navbarCollapse = Halogen_HTML_Attributes.className("navbar-collapse");
var navbarBtn = Halogen_HTML_Attributes.className("navbar-btn");
var navbarBrand = Halogen_HTML_Attributes.className("navbar-brand");
var navbar = Halogen_HTML_Attributes.className("navbar");
var navTabsJustified = Halogen_HTML_Attributes.className("nav-tabs-justified");
var navTabs = Halogen_HTML_Attributes.className("nav-tabs");
var navStacked = Halogen_HTML_Attributes.className("nav-stacked");
var navPills = Halogen_HTML_Attributes.className("nav-pills");
var navJustified = Halogen_HTML_Attributes.className("nav-justified");
var navDivider = Halogen_HTML_Attributes.className("nav-divider");
var nav = Halogen_HTML_Attributes.className("nav");
var modalTitle = Halogen_HTML_Attributes.className("modal-title");
var modalSm = Halogen_HTML_Attributes.className("modal-sm");
var modalScrollbarMeasure = Halogen_HTML_Attributes.className("modal-scrollbar-measure");
var modalOpen = Halogen_HTML_Attributes.className("modal-open");
var modalLg = Halogen_HTML_Attributes.className("modal-lg");
var modalHeader = Halogen_HTML_Attributes.className("modal-header");
var modalFooter = Halogen_HTML_Attributes.className("modal-footer");
var modalDialog = Halogen_HTML_Attributes.className("modal-dialog");
var modalContent = Halogen_HTML_Attributes.className("modal-content");
var modalBody = Halogen_HTML_Attributes.className("modal-body");
var modalBackdrop = Halogen_HTML_Attributes.className("modal-backdrop");
var modal = Halogen_HTML_Attributes.className("modal");
var mediaRight = Halogen_HTML_Attributes.className("media-right");
var mediaObject = Halogen_HTML_Attributes.className("media-object");
var mediaMiddle = Halogen_HTML_Attributes.className("media-middle");
var mediaList = Halogen_HTML_Attributes.className("media-list");
var mediaLeft = Halogen_HTML_Attributes.className("media-left");
var mediaHeading = Halogen_HTML_Attributes.className("media-heading");
var mediaBottom = Halogen_HTML_Attributes.className("media-bottom");
var mediaBody = Halogen_HTML_Attributes.className("media-body");
var media = Halogen_HTML_Attributes.className("media");
var mark = Halogen_HTML_Attributes.className("mark");
var listUnstyled = Halogen_HTML_Attributes.className("list-unstyled");
var listInline = Halogen_HTML_Attributes.className("list-inline");
var listGroupItemWarning = Halogen_HTML_Attributes.className("list-group-item-warning");
var listGroupItemText = Halogen_HTML_Attributes.className("list-group-item-text");
var listGroupItemSuccess = Halogen_HTML_Attributes.className("list-group-item-success");
var listGroupItemInfo = Halogen_HTML_Attributes.className("list-group-item-info");
var listGroupItemHeading = Halogen_HTML_Attributes.className("list-group-item-heading");
var listGroupItemDanger = Halogen_HTML_Attributes.className("list-group-item-danger");
var listGroupItem = Halogen_HTML_Attributes.className("list-group-item");
var listGroup = Halogen_HTML_Attributes.className("list-group");
var left = Halogen_HTML_Attributes.className("left");
var lead = Halogen_HTML_Attributes.className("lead");
var labelWarning = Halogen_HTML_Attributes.className("label-warning");
var labelSuccess = Halogen_HTML_Attributes.className("label-success");
var labelPrimary = Halogen_HTML_Attributes.className("label-primary");
var labelInfo = Halogen_HTML_Attributes.className("label-info");
var labelDefault = Halogen_HTML_Attributes.className("label-default");
var labelDanger = Halogen_HTML_Attributes.className("label-danger");
var label = Halogen_HTML_Attributes.className("label");
var jumbotron = Halogen_HTML_Attributes.className("jumbotron");
var item = Halogen_HTML_Attributes.className("item");
var invisible = Halogen_HTML_Attributes.className("invisible");
var inputSm = Halogen_HTML_Attributes.className("input-sm");
var inputLg = Halogen_HTML_Attributes.className("input-lg");
var inputGroupSm = Halogen_HTML_Attributes.className("input-group-sm");
var inputGroupLg = Halogen_HTML_Attributes.className("input-group-lg");
var inputGroupBtn = Halogen_HTML_Attributes.className("input-group-btn");
var inputGroupAddon = Halogen_HTML_Attributes.className("input-group-addon");
var inputGroup = Halogen_HTML_Attributes.className("input-group");
var initialism = Halogen_HTML_Attributes.className("initialism");
var info = Halogen_HTML_Attributes.className("info");
var in_ = Halogen_HTML_Attributes.className("in");
var imgThumbnail = Halogen_HTML_Attributes.className("img-thumbnail");
var imgRounded = Halogen_HTML_Attributes.className("img-rounded");
var imgResponsive = Halogen_HTML_Attributes.className("img-responsive");
var imgCircle = Halogen_HTML_Attributes.className("img-circle");
var iconPrev = Halogen_HTML_Attributes.className("icon-prev");
var iconNext = Halogen_HTML_Attributes.className("icon-next");
var iconBar = Halogen_HTML_Attributes.className("icon-bar");
var hide = Halogen_HTML_Attributes.className("hide");
var hiddenXs = Halogen_HTML_Attributes.className("hidden-xs");
var hiddenSm = Halogen_HTML_Attributes.className("hidden-sm");
var hiddenPrint = Halogen_HTML_Attributes.className("hidden-print");
var hiddenMd = Halogen_HTML_Attributes.className("hidden-md");
var hiddenLg = Halogen_HTML_Attributes.className("hidden-lg");
var hidden = Halogen_HTML_Attributes.className("hidden");
var helpBlock = Halogen_HTML_Attributes.className("help-block");
var hasWarning = Halogen_HTML_Attributes.className("has-warning");
var hasSuccess = Halogen_HTML_Attributes.className("has-success");
var hasFeedback = Halogen_HTML_Attributes.className("has-feedback");
var hasError = Halogen_HTML_Attributes.className("has-error");
var h6 = Halogen_HTML_Attributes.className("h6");
var h5 = Halogen_HTML_Attributes.className("h5");
var h4 = Halogen_HTML_Attributes.className("h4");
var h3 = Halogen_HTML_Attributes.className("h3");
var h2 = Halogen_HTML_Attributes.className("h2");
var h1 = Halogen_HTML_Attributes.className("h1");
var gradient = Halogen_HTML_Attributes.className("gradient");
var glyphiconZoomOut = Halogen_HTML_Attributes.className("glyphicon-zoom-out");
var glyphiconZoomIn = Halogen_HTML_Attributes.className("glyphicon-zoom-in");
var glyphiconYen = Halogen_HTML_Attributes.className("glyphicon-yen");
var glyphiconWrench = Halogen_HTML_Attributes.className("glyphicon-wrench");
var glyphiconWarningSign = Halogen_HTML_Attributes.className("glyphicon-warning-sign");
var glyphiconVolumeUp = Halogen_HTML_Attributes.className("glyphicon-volume-up");
var glyphiconVolumeOff = Halogen_HTML_Attributes.className("glyphicon-volume-off");
var glyphiconVolumeDown = Halogen_HTML_Attributes.className("glyphicon-volume-down");
var glyphiconUser = Halogen_HTML_Attributes.className("glyphicon-user");
var glyphiconUsd = Halogen_HTML_Attributes.className("glyphicon-usd");
var glyphiconUpload = Halogen_HTML_Attributes.className("glyphicon-upload");
var glyphiconUnchecked = Halogen_HTML_Attributes.className("glyphicon-unchecked");
var glyphiconTriangleTop = Halogen_HTML_Attributes.className("glyphicon-triangle-top");
var glyphiconTriangleRight = Halogen_HTML_Attributes.className("glyphicon-triangle-right");
var glyphiconTriangleLeft = Halogen_HTML_Attributes.className("glyphicon-triangle-left");
var glyphiconTriangleBottom = Halogen_HTML_Attributes.className("glyphicon-triangle-bottom");
var glyphiconTreeDeciduous = Halogen_HTML_Attributes.className("glyphicon-tree-deciduous");
var glyphiconTreeConifer = Halogen_HTML_Attributes.className("glyphicon-tree-conifer");
var glyphiconTrash = Halogen_HTML_Attributes.className("glyphicon-trash");
var glyphiconTransfer = Halogen_HTML_Attributes.className("glyphicon-transfer");
var glyphiconTower = Halogen_HTML_Attributes.className("glyphicon-tower");
var glyphiconTint = Halogen_HTML_Attributes.className("glyphicon-tint");
var glyphiconTime = Halogen_HTML_Attributes.className("glyphicon-time");
var glyphiconThumbsUp = Halogen_HTML_Attributes.className("glyphicon-thumbs-up");
var glyphiconThumbsDown = Halogen_HTML_Attributes.className("glyphicon-thumbs-down");
var glyphiconThList = Halogen_HTML_Attributes.className("glyphicon-th-list");
var glyphiconThLarge = Halogen_HTML_Attributes.className("glyphicon-th-large");
var glyphiconTh = Halogen_HTML_Attributes.className("glyphicon-th");
var glyphiconTextWidth = Halogen_HTML_Attributes.className("glyphicon-text-width");
var glyphiconTextSize = Halogen_HTML_Attributes.className("glyphicon-text-size");
var glyphiconTextHeight = Halogen_HTML_Attributes.className("glyphicon-text-height");
var glyphiconTextColor = Halogen_HTML_Attributes.className("glyphicon-text-color");
var glyphiconTextBackground = Halogen_HTML_Attributes.className("glyphicon-text-background");
var glyphiconTent = Halogen_HTML_Attributes.className("glyphicon-tent");
var glyphiconTasks = Halogen_HTML_Attributes.className("glyphicon-tasks");
var glyphiconTags = Halogen_HTML_Attributes.className("glyphicon-tags");
var glyphiconTag = Halogen_HTML_Attributes.className("glyphicon-tag");
var glyphiconSuperscript = Halogen_HTML_Attributes.className("glyphicon-superscript");
var glyphiconSunglasses = Halogen_HTML_Attributes.className("glyphicon-sunglasses");
var glyphiconSubtitles = Halogen_HTML_Attributes.className("glyphicon-subtitles");
var glyphiconSubscript = Halogen_HTML_Attributes.className("glyphicon-subscript");
var glyphiconStop = Halogen_HTML_Attributes.className("glyphicon-stop");
var glyphiconStepForward = Halogen_HTML_Attributes.className("glyphicon-step-forward");
var glyphiconStepBackward = Halogen_HTML_Attributes.className("glyphicon-step-backward");
var glyphiconStats = Halogen_HTML_Attributes.className("glyphicon-stats");
var glyphiconStarEmpty = Halogen_HTML_Attributes.className("glyphicon-star-empty");
var glyphiconStar = Halogen_HTML_Attributes.className("glyphicon-star");
var glyphiconSoundStereo = Halogen_HTML_Attributes.className("glyphicon-sound-stereo");
var glyphiconSoundDolby = Halogen_HTML_Attributes.className("glyphicon-sound-dolby");
var glyphiconSound7_1 = Halogen_HTML_Attributes.className("glyphicon-sound-7-1");
var glyphiconSound6_1 = Halogen_HTML_Attributes.className("glyphicon-sound-6-1");
var glyphiconSound5_1 = Halogen_HTML_Attributes.className("glyphicon-sound-5-1");
var glyphiconSortByOrderAlt = Halogen_HTML_Attributes.className("glyphicon-sort-by-order-alt");
var glyphiconSortByOrder = Halogen_HTML_Attributes.className("glyphicon-sort-by-order");
var glyphiconSortByAttributesAlt = Halogen_HTML_Attributes.className("glyphicon-sort-by-attributes-alt");
var glyphiconSortByAttributes = Halogen_HTML_Attributes.className("glyphicon-sort-by-attributes");
var glyphiconSortByAlphabetAlt = Halogen_HTML_Attributes.className("glyphicon-sort-by-alphabet-alt");
var glyphiconSortByAlphabet = Halogen_HTML_Attributes.className("glyphicon-sort-by-alphabet");
var glyphiconSort = Halogen_HTML_Attributes.className("glyphicon-sort");
var glyphiconSignal = Halogen_HTML_Attributes.className("glyphicon-signal");
var glyphiconShoppingCart = Halogen_HTML_Attributes.className("glyphicon-shopping-cart");
var glyphiconShareAlt = Halogen_HTML_Attributes.className("glyphicon-share-alt");
var glyphiconShare = Halogen_HTML_Attributes.className("glyphicon-share");
var glyphiconSend = Halogen_HTML_Attributes.className("glyphicon-send");
var glyphiconSearch = Halogen_HTML_Attributes.className("glyphicon-search");
var glyphiconSdVideo = Halogen_HTML_Attributes.className("glyphicon-sd-video");
var glyphiconScreenshot = Halogen_HTML_Attributes.className("glyphicon-screenshot");
var glyphiconScissors = Halogen_HTML_Attributes.className("glyphicon-scissors");
var glyphiconScale = Halogen_HTML_Attributes.className("glyphicon-scale");
var glyphiconSaved = Halogen_HTML_Attributes.className("glyphicon-saved");
var glyphiconSaveFile = Halogen_HTML_Attributes.className("glyphicon-save-file");
var glyphiconSave = Halogen_HTML_Attributes.className("glyphicon-save");
var glyphiconRuble = Halogen_HTML_Attributes.className("glyphicon-ruble");
var glyphiconRoad = Halogen_HTML_Attributes.className("glyphicon-road");
var glyphiconRetweet = Halogen_HTML_Attributes.className("glyphicon-retweet");
var glyphiconResizeVertical = Halogen_HTML_Attributes.className("glyphicon-resize-vertical");
var glyphiconResizeSmall = Halogen_HTML_Attributes.className("glyphicon-resize-small");
var glyphiconResizeHorizontal = Halogen_HTML_Attributes.className("glyphicon-resize-horizontal");
var glyphiconResizeFull = Halogen_HTML_Attributes.className("glyphicon-resize-full");
var glyphiconRepeat = Halogen_HTML_Attributes.className("glyphicon-repeat");
var glyphiconRemoveSign = Halogen_HTML_Attributes.className("glyphicon-remove-sign");
var glyphiconRemoveCircle = Halogen_HTML_Attributes.className("glyphicon-remove-circle");
var glyphiconRemove = Halogen_HTML_Attributes.className("glyphicon-remove");
var glyphiconRegistrationMark = Halogen_HTML_Attributes.className("glyphicon-registration-mark");
var glyphiconRefresh = Halogen_HTML_Attributes.className("glyphicon-refresh");
var glyphiconRecord = Halogen_HTML_Attributes.className("glyphicon-record");
var glyphiconRandom = Halogen_HTML_Attributes.className("glyphicon-random");
var glyphiconQuestionSign = Halogen_HTML_Attributes.className("glyphicon-question-sign");
var glyphiconQueen = Halogen_HTML_Attributes.className("glyphicon-queen");
var glyphiconQrcode = Halogen_HTML_Attributes.className("glyphicon-qrcode");
var glyphiconPushpin = Halogen_HTML_Attributes.className("glyphicon-pushpin");
var glyphiconPrint = Halogen_HTML_Attributes.className("glyphicon-print");
var glyphiconPlusSign = Halogen_HTML_Attributes.className("glyphicon-plus-sign");
var glyphiconPlus = Halogen_HTML_Attributes.className("glyphicon-plus");
var glyphiconPlayCircle = Halogen_HTML_Attributes.className("glyphicon-play-circle");
var glyphiconPlay = Halogen_HTML_Attributes.className("glyphicon-play");
var glyphiconPlane = Halogen_HTML_Attributes.className("glyphicon-plane");
var glyphiconPiggyBank = Halogen_HTML_Attributes.className("glyphicon-piggy-bank");
var glyphiconPicture = Halogen_HTML_Attributes.className("glyphicon-picture");
var glyphiconPhoneAlt = Halogen_HTML_Attributes.className("glyphicon-phone-alt");
var glyphiconPhone = Halogen_HTML_Attributes.className("glyphicon-phone");
var glyphiconPencil = Halogen_HTML_Attributes.className("glyphicon-pencil");
var glyphiconPawn = Halogen_HTML_Attributes.className("glyphicon-pawn");
var glyphiconPause = Halogen_HTML_Attributes.className("glyphicon-pause");
var glyphiconPaste = Halogen_HTML_Attributes.className("glyphicon-paste");
var glyphiconPaperclip = Halogen_HTML_Attributes.className("glyphicon-paperclip");
var glyphiconOptionVertical = Halogen_HTML_Attributes.className("glyphicon-option-vertical");
var glyphiconOptionHorizontal = Halogen_HTML_Attributes.className("glyphicon-option-horizontal");
var glyphiconOpenFile = Halogen_HTML_Attributes.className("glyphicon-open-file");
var glyphiconOpen = Halogen_HTML_Attributes.className("glyphicon-open");
var glyphiconOkSign = Halogen_HTML_Attributes.className("glyphicon-ok-sign");
var glyphiconOkCircle = Halogen_HTML_Attributes.className("glyphicon-ok-circle");
var glyphiconOk = Halogen_HTML_Attributes.className("glyphicon-ok");
var glyphiconOil = Halogen_HTML_Attributes.className("glyphicon-oil");
var glyphiconOff = Halogen_HTML_Attributes.className("glyphicon-off");
var glyphiconObjectAlignVertical = Halogen_HTML_Attributes.className("glyphicon-object-align-vertical");
var glyphiconObjectAlignTop = Halogen_HTML_Attributes.className("glyphicon-object-align-top");
var glyphiconObjectAlignRight = Halogen_HTML_Attributes.className("glyphicon-object-align-right");
var glyphiconObjectAlignLeft = Halogen_HTML_Attributes.className("glyphicon-object-align-left");
var glyphiconObjectAlignHorizontal = Halogen_HTML_Attributes.className("glyphicon-object-align-horizontal");
var glyphiconObjectAlignBottom = Halogen_HTML_Attributes.className("glyphicon-object-align-bottom");
var glyphiconNewWindow = Halogen_HTML_Attributes.className("glyphicon-new-window");
var glyphiconMusic = Halogen_HTML_Attributes.className("glyphicon-music");
var glyphiconMove = Halogen_HTML_Attributes.className("glyphicon-move");
var glyphiconModalWindow = Halogen_HTML_Attributes.className("glyphicon-modal-window");
var glyphiconMinusSign = Halogen_HTML_Attributes.className("glyphicon-minus-sign");
var glyphiconMinus = Halogen_HTML_Attributes.className("glyphicon-minus");
var glyphiconMenuUp = Halogen_HTML_Attributes.className("glyphicon-menu-up");
var glyphiconMenuRight = Halogen_HTML_Attributes.className("glyphicon-menu-right");
var glyphiconMenuLeft = Halogen_HTML_Attributes.className("glyphicon-menu-left");
var glyphiconMenuHamburger = Halogen_HTML_Attributes.className("glyphicon-menu-hamburger");
var glyphiconMenuDown = Halogen_HTML_Attributes.className("glyphicon-menu-down");
var glyphiconMapMarker = Halogen_HTML_Attributes.className("glyphicon-map-marker");
var glyphiconMagnet = Halogen_HTML_Attributes.className("glyphicon-magnet");
var glyphiconLogOut = Halogen_HTML_Attributes.className("glyphicon-log-out");
var glyphiconLogIn = Halogen_HTML_Attributes.className("glyphicon-log-in");
var glyphiconLock = Halogen_HTML_Attributes.className("glyphicon-lock");
var glyphiconListAlt = Halogen_HTML_Attributes.className("glyphicon-list-alt");
var glyphiconList = Halogen_HTML_Attributes.className("glyphicon-list");
var glyphiconLink = Halogen_HTML_Attributes.className("glyphicon-link");
var glyphiconLevelUp = Halogen_HTML_Attributes.className("glyphicon-level-up");
var glyphiconLeaf = Halogen_HTML_Attributes.className("glyphicon-leaf");
var glyphiconLamp = Halogen_HTML_Attributes.className("glyphicon-lamp");
var glyphiconKnight = Halogen_HTML_Attributes.className("glyphicon-knight");
var glyphiconKing = Halogen_HTML_Attributes.className("glyphicon-king");
var glyphiconItalic = Halogen_HTML_Attributes.className("glyphicon-italic");
var glyphiconInfoSign = Halogen_HTML_Attributes.className("glyphicon-info-sign");
var glyphiconIndentRight = Halogen_HTML_Attributes.className("glyphicon-indent-right");
var glyphiconIndentLeft = Halogen_HTML_Attributes.className("glyphicon-indent-left");
var glyphiconInbox = Halogen_HTML_Attributes.className("glyphicon-inbox");
var glyphiconImport = Halogen_HTML_Attributes.className("glyphicon-import");
var glyphiconIceLollyTasted = Halogen_HTML_Attributes.className("glyphicon-ice-lolly-tasted");
var glyphiconIceLolly = Halogen_HTML_Attributes.className("glyphicon-ice-lolly");
var glyphiconHourglass = Halogen_HTML_Attributes.className("glyphicon-hourglass");
var glyphiconHome = Halogen_HTML_Attributes.className("glyphicon-home");
var glyphiconHeartEmpty = Halogen_HTML_Attributes.className("glyphicon-heart-empty");
var glyphiconHeart = Halogen_HTML_Attributes.className("glyphicon-heart");
var glyphiconHeadphones = Halogen_HTML_Attributes.className("glyphicon-headphones");
var glyphiconHeader = Halogen_HTML_Attributes.className("glyphicon-header");
var glyphiconHdd = Halogen_HTML_Attributes.className("glyphicon-hdd");
var glyphiconHdVideo = Halogen_HTML_Attributes.className("glyphicon-hd-video");
var glyphiconHandUp = Halogen_HTML_Attributes.className("glyphicon-hand-up");
var glyphiconHandRight = Halogen_HTML_Attributes.className("glyphicon-hand-right");
var glyphiconHandLeft = Halogen_HTML_Attributes.className("glyphicon-hand-left");
var glyphiconHandDown = Halogen_HTML_Attributes.className("glyphicon-hand-down");
var glyphiconGrain = Halogen_HTML_Attributes.className("glyphicon-grain");
var glyphiconGlobe = Halogen_HTML_Attributes.className("glyphicon-globe");
var glyphiconGlass = Halogen_HTML_Attributes.className("glyphicon-glass");
var glyphiconGift = Halogen_HTML_Attributes.className("glyphicon-gift");
var glyphiconGbp = Halogen_HTML_Attributes.className("glyphicon-gbp");
var glyphiconFullscreen = Halogen_HTML_Attributes.className("glyphicon-fullscreen");
var glyphiconForward = Halogen_HTML_Attributes.className("glyphicon-forward");
var glyphiconFont = Halogen_HTML_Attributes.className("glyphicon-font");
var glyphiconFolderOpen = Halogen_HTML_Attributes.className("glyphicon-folder-open");
var glyphiconFolderClose = Halogen_HTML_Attributes.className("glyphicon-folder-close");
var glyphiconFloppySaved = Halogen_HTML_Attributes.className("glyphicon-floppy-saved");
var glyphiconFloppySave = Halogen_HTML_Attributes.className("glyphicon-floppy-save");
var glyphiconFloppyRemove = Halogen_HTML_Attributes.className("glyphicon-floppy-remove");
var glyphiconFloppyOpen = Halogen_HTML_Attributes.className("glyphicon-floppy-open");
var glyphiconFloppyDisk = Halogen_HTML_Attributes.className("glyphicon-floppy-disk");
var glyphiconFlash = Halogen_HTML_Attributes.className("glyphicon-flash");
var glyphiconFlag = Halogen_HTML_Attributes.className("glyphicon-flag");
var glyphiconFire = Halogen_HTML_Attributes.className("glyphicon-fire");
var glyphiconFilter = Halogen_HTML_Attributes.className("glyphicon-filter");
var glyphiconFilm = Halogen_HTML_Attributes.className("glyphicon-film");
var glyphiconFile = Halogen_HTML_Attributes.className("glyphicon-file");
var glyphiconFastForward = Halogen_HTML_Attributes.className("glyphicon-fast-forward");
var glyphiconFastBackward = Halogen_HTML_Attributes.className("glyphicon-fast-backward");
var glyphiconFacetimeVideo = Halogen_HTML_Attributes.className("glyphicon-facetime-video");
var glyphiconEyeOpen = Halogen_HTML_Attributes.className("glyphicon-eye-open");
var glyphiconEyeClose = Halogen_HTML_Attributes.className("glyphicon-eye-close");
var glyphiconExport = Halogen_HTML_Attributes.className("glyphicon-export");
var glyphiconExpand = Halogen_HTML_Attributes.className("glyphicon-expand");
var glyphiconExclamationSign = Halogen_HTML_Attributes.className("glyphicon-exclamation-sign");
var glyphiconEuro = Halogen_HTML_Attributes.className("glyphicon-euro");
var glyphiconEur = Halogen_HTML_Attributes.className("glyphicon-eur");
var glyphiconErase = Halogen_HTML_Attributes.className("glyphicon-erase");
var glyphiconEqualizer = Halogen_HTML_Attributes.className("glyphicon-equalizer");
var glyphiconEnvelope = Halogen_HTML_Attributes.className("glyphicon-envelope");
var glyphiconEject = Halogen_HTML_Attributes.className("glyphicon-eject");
var glyphiconEducation = Halogen_HTML_Attributes.className("glyphicon-education");
var glyphiconEdit = Halogen_HTML_Attributes.className("glyphicon-edit");
var glyphiconEarphone = Halogen_HTML_Attributes.className("glyphicon-earphone");
var glyphiconDuplicate = Halogen_HTML_Attributes.className("glyphicon-duplicate");
var glyphiconDownloadAlt = Halogen_HTML_Attributes.className("glyphicon-download-alt");
var glyphiconDownload = Halogen_HTML_Attributes.className("glyphicon-download");
var glyphiconDashboard = Halogen_HTML_Attributes.className("glyphicon-dashboard");
var glyphiconCutlery = Halogen_HTML_Attributes.className("glyphicon-cutlery");
var glyphiconCreditCard = Halogen_HTML_Attributes.className("glyphicon-credit-card");
var glyphiconCopyrightMark = Halogen_HTML_Attributes.className("glyphicon-copyright-mark");
var glyphiconCopy = Halogen_HTML_Attributes.className("glyphicon-copy");
var glyphiconConsole = Halogen_HTML_Attributes.className("glyphicon-console");
var glyphiconCompressed = Halogen_HTML_Attributes.className("glyphicon-compressed");
var glyphiconComment = Halogen_HTML_Attributes.className("glyphicon-comment");
var glyphiconCollapseUp = Halogen_HTML_Attributes.className("glyphicon-collapse-up");
var glyphiconCollapseDown = Halogen_HTML_Attributes.className("glyphicon-collapse-down");
var glyphiconCog = Halogen_HTML_Attributes.className("glyphicon-cog");
var glyphiconCloudUpload = Halogen_HTML_Attributes.className("glyphicon-cloud-upload");
var glyphiconCloudDownload = Halogen_HTML_Attributes.className("glyphicon-cloud-download");
var glyphiconCloud = Halogen_HTML_Attributes.className("glyphicon-cloud");
var glyphiconCircleArrowUp = Halogen_HTML_Attributes.className("glyphicon-circle-arrow-up");
var glyphiconCircleArrowRight = Halogen_HTML_Attributes.className("glyphicon-circle-arrow-right");
var glyphiconCircleArrowLeft = Halogen_HTML_Attributes.className("glyphicon-circle-arrow-left");
var glyphiconCircleArrowDown = Halogen_HTML_Attributes.className("glyphicon-circle-arrow-down");
var glyphiconChevronUp = Halogen_HTML_Attributes.className("glyphicon-chevron-up");
var glyphiconChevronRight = Halogen_HTML_Attributes.className("glyphicon-chevron-right");
var glyphiconChevronLeft = Halogen_HTML_Attributes.className("glyphicon-chevron-left");
var glyphiconChevronDown = Halogen_HTML_Attributes.className("glyphicon-chevron-down");
var glyphiconCheck = Halogen_HTML_Attributes.className("glyphicon-check");
var glyphiconCertificate = Halogen_HTML_Attributes.className("glyphicon-certificate");
var glyphiconCd = Halogen_HTML_Attributes.className("glyphicon-cd");
var glyphiconCamera = Halogen_HTML_Attributes.className("glyphicon-camera");
var glyphiconCalendar = Halogen_HTML_Attributes.className("glyphicon-calendar");
var glyphiconBullhorn = Halogen_HTML_Attributes.className("glyphicon-bullhorn");
var glyphiconBriefcase = Halogen_HTML_Attributes.className("glyphicon-briefcase");
var glyphiconBookmark = Halogen_HTML_Attributes.className("glyphicon-bookmark");
var glyphiconBook = Halogen_HTML_Attributes.className("glyphicon-book");
var glyphiconBold = Halogen_HTML_Attributes.className("glyphicon-bold");
var glyphiconBlackboard = Halogen_HTML_Attributes.className("glyphicon-blackboard");
var glyphiconBitcoin = Halogen_HTML_Attributes.className("glyphicon-bitcoin");
var glyphiconBishop = Halogen_HTML_Attributes.className("glyphicon-bishop");
var glyphiconBell = Halogen_HTML_Attributes.className("glyphicon-bell");
var glyphiconBed = Halogen_HTML_Attributes.className("glyphicon-bed");
var glyphiconBarcode = Halogen_HTML_Attributes.className("glyphicon-barcode");
var glyphiconBanCircle = Halogen_HTML_Attributes.className("glyphicon-ban-circle");
var glyphiconBackward = Halogen_HTML_Attributes.className("glyphicon-backward");
var glyphiconBabyFormula = Halogen_HTML_Attributes.className("glyphicon-baby-formula");
var glyphiconAsterisk = Halogen_HTML_Attributes.className("glyphicon-asterisk");
var glyphiconArrowUp = Halogen_HTML_Attributes.className("glyphicon-arrow-up");
var glyphiconArrowRight = Halogen_HTML_Attributes.className("glyphicon-arrow-right");
var glyphiconArrowLeft = Halogen_HTML_Attributes.className("glyphicon-arrow-left");
var glyphiconArrowDown = Halogen_HTML_Attributes.className("glyphicon-arrow-down");
var glyphiconApple = Halogen_HTML_Attributes.className("glyphicon-apple");
var glyphiconAlignRight = Halogen_HTML_Attributes.className("glyphicon-align-right");
var glyphiconAlignLeft = Halogen_HTML_Attributes.className("glyphicon-align-left");
var glyphiconAlignJustify = Halogen_HTML_Attributes.className("glyphicon-align-justify");
var glyphiconAlignCenter = Halogen_HTML_Attributes.className("glyphicon-align-center");
var glyphiconAlert = Halogen_HTML_Attributes.className("glyphicon-alert");
var glyphiconAdjust = Halogen_HTML_Attributes.className("glyphicon-adjust");
var glyphicon = Halogen_HTML_Attributes.className("glyphicon");
var formInline = Halogen_HTML_Attributes.className("form-inline");
var formHorizontal = Halogen_HTML_Attributes.className("form-horizontal");
var formGroupSm = Halogen_HTML_Attributes.className("form-group-sm");
var formGroupLg = Halogen_HTML_Attributes.className("form-group-lg");
var formGroup = Halogen_HTML_Attributes.className("form-group");
var formControlStatic = Halogen_HTML_Attributes.className("form-control-static");
var formControlFeedback = Halogen_HTML_Attributes.className("form-control-feedback");
var formControl = Halogen_HTML_Attributes.className("form-control");
var focus = Halogen_HTML_Attributes.className("focus");
var fade = Halogen_HTML_Attributes.className("fade");
var eot = Halogen_HTML_Attributes.className("eot");
var embedResponsiveItem = Halogen_HTML_Attributes.className("embed-responsive-item");
var embedResponsive4By3 = Halogen_HTML_Attributes.className("embed-responsive-4by3");
var embedResponsive16By9 = Halogen_HTML_Attributes.className("embed-responsive-16by9");
var embedResponsive = Halogen_HTML_Attributes.className("embed-responsive");
var dropup = Halogen_HTML_Attributes.className("dropup");
var dropdownToggle = Halogen_HTML_Attributes.className("dropdown-toggle");
var dropdownMenuRight = Halogen_HTML_Attributes.className("dropdown-menu-right");
var dropdownMenuLeft = Halogen_HTML_Attributes.className("dropdown-menu-left");
var dropdownMenu = Halogen_HTML_Attributes.className("dropdown-menu");
var dropdownHeader = Halogen_HTML_Attributes.className("dropdown-header");
var dropdownBackdrop = Halogen_HTML_Attributes.className("dropdown-backdrop");
var dropdown = Halogen_HTML_Attributes.className("dropdown");
var dlHorizontal = Halogen_HTML_Attributes.className("dl-horizontal");
var divider = Halogen_HTML_Attributes.className("divider");
var disabled = Halogen_HTML_Attributes.className("disabled");
var danger = Halogen_HTML_Attributes.className("danger");
var controlLabel = Halogen_HTML_Attributes.className("control-label");
var containerFluid = Halogen_HTML_Attributes.className("container-fluid");
var container = Halogen_HTML_Attributes.className("container");
var collapsing = Halogen_HTML_Attributes.className("collapsing");
var collapse = Halogen_HTML_Attributes.className("collapse");
var colXsPush9 = Halogen_HTML_Attributes.className("col-xs-push-9");
var colXsPush8 = Halogen_HTML_Attributes.className("col-xs-push-8");
var colXsPush7 = Halogen_HTML_Attributes.className("col-xs-push-7");
var colXsPush6 = Halogen_HTML_Attributes.className("col-xs-push-6");
var colXsPush5 = Halogen_HTML_Attributes.className("col-xs-push-5");
var colXsPush4 = Halogen_HTML_Attributes.className("col-xs-push-4");
var colXsPush3 = Halogen_HTML_Attributes.className("col-xs-push-3");
var colXsPush2 = Halogen_HTML_Attributes.className("col-xs-push-2");
var colXsPush12 = Halogen_HTML_Attributes.className("col-xs-push-12");
var colXsPush11 = Halogen_HTML_Attributes.className("col-xs-push-11");
var colXsPush10 = Halogen_HTML_Attributes.className("col-xs-push-10");
var colXsPush1 = Halogen_HTML_Attributes.className("col-xs-push-1");
var colXsPush0 = Halogen_HTML_Attributes.className("col-xs-push-0");
var colXsPull9 = Halogen_HTML_Attributes.className("col-xs-pull-9");
var colXsPull8 = Halogen_HTML_Attributes.className("col-xs-pull-8");
var colXsPull7 = Halogen_HTML_Attributes.className("col-xs-pull-7");
var colXsPull6 = Halogen_HTML_Attributes.className("col-xs-pull-6");
var colXsPull5 = Halogen_HTML_Attributes.className("col-xs-pull-5");
var colXsPull4 = Halogen_HTML_Attributes.className("col-xs-pull-4");
var colXsPull3 = Halogen_HTML_Attributes.className("col-xs-pull-3");
var colXsPull2 = Halogen_HTML_Attributes.className("col-xs-pull-2");
var colXsPull12 = Halogen_HTML_Attributes.className("col-xs-pull-12");
var colXsPull11 = Halogen_HTML_Attributes.className("col-xs-pull-11");
var colXsPull10 = Halogen_HTML_Attributes.className("col-xs-pull-10");
var colXsPull1 = Halogen_HTML_Attributes.className("col-xs-pull-1");
var colXsPull0 = Halogen_HTML_Attributes.className("col-xs-pull-0");
var colXsOffset9 = Halogen_HTML_Attributes.className("col-xs-offset-9");
var colXsOffset8 = Halogen_HTML_Attributes.className("col-xs-offset-8");
var colXsOffset7 = Halogen_HTML_Attributes.className("col-xs-offset-7");
var colXsOffset6 = Halogen_HTML_Attributes.className("col-xs-offset-6");
var colXsOffset5 = Halogen_HTML_Attributes.className("col-xs-offset-5");
var colXsOffset4 = Halogen_HTML_Attributes.className("col-xs-offset-4");
var colXsOffset3 = Halogen_HTML_Attributes.className("col-xs-offset-3");
var colXsOffset2 = Halogen_HTML_Attributes.className("col-xs-offset-2");
var colXsOffset12 = Halogen_HTML_Attributes.className("col-xs-offset-12");
var colXsOffset11 = Halogen_HTML_Attributes.className("col-xs-offset-11");
var colXsOffset10 = Halogen_HTML_Attributes.className("col-xs-offset-10");
var colXsOffset1 = Halogen_HTML_Attributes.className("col-xs-offset-1");
var colXsOffset0 = Halogen_HTML_Attributes.className("col-xs-offset-0");
var colXs9 = Halogen_HTML_Attributes.className("col-xs-9");
var colXs8 = Halogen_HTML_Attributes.className("col-xs-8");
var colXs7 = Halogen_HTML_Attributes.className("col-xs-7");
var colXs6 = Halogen_HTML_Attributes.className("col-xs-6");
var colXs5 = Halogen_HTML_Attributes.className("col-xs-5");
var colXs4 = Halogen_HTML_Attributes.className("col-xs-4");
var colXs3 = Halogen_HTML_Attributes.className("col-xs-3");
var colXs2 = Halogen_HTML_Attributes.className("col-xs-2");
var colXs12 = Halogen_HTML_Attributes.className("col-xs-12");
var colXs11 = Halogen_HTML_Attributes.className("col-xs-11");
var colXs10 = Halogen_HTML_Attributes.className("col-xs-10");
var colXs1 = Halogen_HTML_Attributes.className("col-xs-1");
var colSmPush9 = Halogen_HTML_Attributes.className("col-sm-push-9");
var colSmPush8 = Halogen_HTML_Attributes.className("col-sm-push-8");
var colSmPush7 = Halogen_HTML_Attributes.className("col-sm-push-7");
var colSmPush6 = Halogen_HTML_Attributes.className("col-sm-push-6");
var colSmPush5 = Halogen_HTML_Attributes.className("col-sm-push-5");
var colSmPush4 = Halogen_HTML_Attributes.className("col-sm-push-4");
var colSmPush3 = Halogen_HTML_Attributes.className("col-sm-push-3");
var colSmPush2 = Halogen_HTML_Attributes.className("col-sm-push-2");
var colSmPush12 = Halogen_HTML_Attributes.className("col-sm-push-12");
var colSmPush11 = Halogen_HTML_Attributes.className("col-sm-push-11");
var colSmPush10 = Halogen_HTML_Attributes.className("col-sm-push-10");
var colSmPush1 = Halogen_HTML_Attributes.className("col-sm-push-1");
var colSmPush0 = Halogen_HTML_Attributes.className("col-sm-push-0");
var colSmPull9 = Halogen_HTML_Attributes.className("col-sm-pull-9");
var colSmPull8 = Halogen_HTML_Attributes.className("col-sm-pull-8");
var colSmPull7 = Halogen_HTML_Attributes.className("col-sm-pull-7");
var colSmPull6 = Halogen_HTML_Attributes.className("col-sm-pull-6");
var colSmPull5 = Halogen_HTML_Attributes.className("col-sm-pull-5");
var colSmPull4 = Halogen_HTML_Attributes.className("col-sm-pull-4");
var colSmPull3 = Halogen_HTML_Attributes.className("col-sm-pull-3");
var colSmPull2 = Halogen_HTML_Attributes.className("col-sm-pull-2");
var colSmPull12 = Halogen_HTML_Attributes.className("col-sm-pull-12");
var colSmPull11 = Halogen_HTML_Attributes.className("col-sm-pull-11");
var colSmPull10 = Halogen_HTML_Attributes.className("col-sm-pull-10");
var colSmPull1 = Halogen_HTML_Attributes.className("col-sm-pull-1");
var colSmPull0 = Halogen_HTML_Attributes.className("col-sm-pull-0");
var colSmOffset9 = Halogen_HTML_Attributes.className("col-sm-offset-9");
var colSmOffset8 = Halogen_HTML_Attributes.className("col-sm-offset-8");
var colSmOffset7 = Halogen_HTML_Attributes.className("col-sm-offset-7");
var colSmOffset6 = Halogen_HTML_Attributes.className("col-sm-offset-6");
var colSmOffset5 = Halogen_HTML_Attributes.className("col-sm-offset-5");
var colSmOffset4 = Halogen_HTML_Attributes.className("col-sm-offset-4");
var colSmOffset3 = Halogen_HTML_Attributes.className("col-sm-offset-3");
var colSmOffset2 = Halogen_HTML_Attributes.className("col-sm-offset-2");
var colSmOffset12 = Halogen_HTML_Attributes.className("col-sm-offset-12");
var colSmOffset11 = Halogen_HTML_Attributes.className("col-sm-offset-11");
var colSmOffset10 = Halogen_HTML_Attributes.className("col-sm-offset-10");
var colSmOffset1 = Halogen_HTML_Attributes.className("col-sm-offset-1");
var colSmOffset0 = Halogen_HTML_Attributes.className("col-sm-offset-0");
var colSm9 = Halogen_HTML_Attributes.className("col-sm-9");
var colSm8 = Halogen_HTML_Attributes.className("col-sm-8");
var colSm7 = Halogen_HTML_Attributes.className("col-sm-7");
var colSm6 = Halogen_HTML_Attributes.className("col-sm-6");
var colSm5 = Halogen_HTML_Attributes.className("col-sm-5");
var colSm4 = Halogen_HTML_Attributes.className("col-sm-4");
var colSm3 = Halogen_HTML_Attributes.className("col-sm-3");
var colSm2 = Halogen_HTML_Attributes.className("col-sm-2");
var colSm12 = Halogen_HTML_Attributes.className("col-sm-12");
var colSm11 = Halogen_HTML_Attributes.className("col-sm-11");
var colSm10 = Halogen_HTML_Attributes.className("col-sm-10");
var colSm1 = Halogen_HTML_Attributes.className("col-sm-1");
var colMdPush9 = Halogen_HTML_Attributes.className("col-md-push-9");
var colMdPush8 = Halogen_HTML_Attributes.className("col-md-push-8");
var colMdPush7 = Halogen_HTML_Attributes.className("col-md-push-7");
var colMdPush6 = Halogen_HTML_Attributes.className("col-md-push-6");
var colMdPush5 = Halogen_HTML_Attributes.className("col-md-push-5");
var colMdPush4 = Halogen_HTML_Attributes.className("col-md-push-4");
var colMdPush3 = Halogen_HTML_Attributes.className("col-md-push-3");
var colMdPush2 = Halogen_HTML_Attributes.className("col-md-push-2");
var colMdPush12 = Halogen_HTML_Attributes.className("col-md-push-12");
var colMdPush11 = Halogen_HTML_Attributes.className("col-md-push-11");
var colMdPush10 = Halogen_HTML_Attributes.className("col-md-push-10");
var colMdPush1 = Halogen_HTML_Attributes.className("col-md-push-1");
var colMdPush0 = Halogen_HTML_Attributes.className("col-md-push-0");
var colMdPull9 = Halogen_HTML_Attributes.className("col-md-pull-9");
var colMdPull8 = Halogen_HTML_Attributes.className("col-md-pull-8");
var colMdPull7 = Halogen_HTML_Attributes.className("col-md-pull-7");
var colMdPull6 = Halogen_HTML_Attributes.className("col-md-pull-6");
var colMdPull5 = Halogen_HTML_Attributes.className("col-md-pull-5");
var colMdPull4 = Halogen_HTML_Attributes.className("col-md-pull-4");
var colMdPull3 = Halogen_HTML_Attributes.className("col-md-pull-3");
var colMdPull2 = Halogen_HTML_Attributes.className("col-md-pull-2");
var colMdPull12 = Halogen_HTML_Attributes.className("col-md-pull-12");
var colMdPull11 = Halogen_HTML_Attributes.className("col-md-pull-11");
var colMdPull10 = Halogen_HTML_Attributes.className("col-md-pull-10");
var colMdPull1 = Halogen_HTML_Attributes.className("col-md-pull-1");
var colMdPull0 = Halogen_HTML_Attributes.className("col-md-pull-0");
var colMdOffset9 = Halogen_HTML_Attributes.className("col-md-offset-9");
var colMdOffset8 = Halogen_HTML_Attributes.className("col-md-offset-8");
var colMdOffset7 = Halogen_HTML_Attributes.className("col-md-offset-7");
var colMdOffset6 = Halogen_HTML_Attributes.className("col-md-offset-6");
var colMdOffset5 = Halogen_HTML_Attributes.className("col-md-offset-5");
var colMdOffset4 = Halogen_HTML_Attributes.className("col-md-offset-4");
var colMdOffset3 = Halogen_HTML_Attributes.className("col-md-offset-3");
var colMdOffset2 = Halogen_HTML_Attributes.className("col-md-offset-2");
var colMdOffset12 = Halogen_HTML_Attributes.className("col-md-offset-12");
var colMdOffset11 = Halogen_HTML_Attributes.className("col-md-offset-11");
var colMdOffset10 = Halogen_HTML_Attributes.className("col-md-offset-10");
var colMdOffset1 = Halogen_HTML_Attributes.className("col-md-offset-1");
var colMdOffset0 = Halogen_HTML_Attributes.className("col-md-offset-0");
var colMd9 = Halogen_HTML_Attributes.className("col-md-9");
var colMd8 = Halogen_HTML_Attributes.className("col-md-8");
var colMd7 = Halogen_HTML_Attributes.className("col-md-7");
var colMd6 = Halogen_HTML_Attributes.className("col-md-6");
var colMd5 = Halogen_HTML_Attributes.className("col-md-5");
var colMd4 = Halogen_HTML_Attributes.className("col-md-4");
var colMd3 = Halogen_HTML_Attributes.className("col-md-3");
var colMd2 = Halogen_HTML_Attributes.className("col-md-2");
var colMd12 = Halogen_HTML_Attributes.className("col-md-12");
var colMd11 = Halogen_HTML_Attributes.className("col-md-11");
var colMd10 = Halogen_HTML_Attributes.className("col-md-10");
var colMd1 = Halogen_HTML_Attributes.className("col-md-1");
var colLgPush9 = Halogen_HTML_Attributes.className("col-lg-push-9");
var colLgPush8 = Halogen_HTML_Attributes.className("col-lg-push-8");
var colLgPush7 = Halogen_HTML_Attributes.className("col-lg-push-7");
var colLgPush6 = Halogen_HTML_Attributes.className("col-lg-push-6");
var colLgPush5 = Halogen_HTML_Attributes.className("col-lg-push-5");
var colLgPush4 = Halogen_HTML_Attributes.className("col-lg-push-4");
var colLgPush3 = Halogen_HTML_Attributes.className("col-lg-push-3");
var colLgPush2 = Halogen_HTML_Attributes.className("col-lg-push-2");
var colLgPush12 = Halogen_HTML_Attributes.className("col-lg-push-12");
var colLgPush11 = Halogen_HTML_Attributes.className("col-lg-push-11");
var colLgPush10 = Halogen_HTML_Attributes.className("col-lg-push-10");
var colLgPush1 = Halogen_HTML_Attributes.className("col-lg-push-1");
var colLgPush0 = Halogen_HTML_Attributes.className("col-lg-push-0");
var colLgPull9 = Halogen_HTML_Attributes.className("col-lg-pull-9");
var colLgPull8 = Halogen_HTML_Attributes.className("col-lg-pull-8");
var colLgPull7 = Halogen_HTML_Attributes.className("col-lg-pull-7");
var colLgPull6 = Halogen_HTML_Attributes.className("col-lg-pull-6");
var colLgPull5 = Halogen_HTML_Attributes.className("col-lg-pull-5");
var colLgPull4 = Halogen_HTML_Attributes.className("col-lg-pull-4");
var colLgPull3 = Halogen_HTML_Attributes.className("col-lg-pull-3");
var colLgPull2 = Halogen_HTML_Attributes.className("col-lg-pull-2");
var colLgPull12 = Halogen_HTML_Attributes.className("col-lg-pull-12");
var colLgPull11 = Halogen_HTML_Attributes.className("col-lg-pull-11");
var colLgPull10 = Halogen_HTML_Attributes.className("col-lg-pull-10");
var colLgPull1 = Halogen_HTML_Attributes.className("col-lg-pull-1");
var colLgPull0 = Halogen_HTML_Attributes.className("col-lg-pull-0");
var colLgOffset9 = Halogen_HTML_Attributes.className("col-lg-offset-9");
var colLgOffset8 = Halogen_HTML_Attributes.className("col-lg-offset-8");
var colLgOffset7 = Halogen_HTML_Attributes.className("col-lg-offset-7");
var colLgOffset6 = Halogen_HTML_Attributes.className("col-lg-offset-6");
var colLgOffset5 = Halogen_HTML_Attributes.className("col-lg-offset-5");
var colLgOffset4 = Halogen_HTML_Attributes.className("col-lg-offset-4");
var colLgOffset3 = Halogen_HTML_Attributes.className("col-lg-offset-3");
var colLgOffset2 = Halogen_HTML_Attributes.className("col-lg-offset-2");
var colLgOffset12 = Halogen_HTML_Attributes.className("col-lg-offset-12");
var colLgOffset11 = Halogen_HTML_Attributes.className("col-lg-offset-11");
var colLgOffset10 = Halogen_HTML_Attributes.className("col-lg-offset-10");
var colLgOffset1 = Halogen_HTML_Attributes.className("col-lg-offset-1");
var colLgOffset0 = Halogen_HTML_Attributes.className("col-lg-offset-0");
var colLg9 = Halogen_HTML_Attributes.className("col-lg-9");
var colLg8 = Halogen_HTML_Attributes.className("col-lg-8");
var colLg7 = Halogen_HTML_Attributes.className("col-lg-7");
var colLg6 = Halogen_HTML_Attributes.className("col-lg-6");
var colLg5 = Halogen_HTML_Attributes.className("col-lg-5");
var colLg4 = Halogen_HTML_Attributes.className("col-lg-4");
var colLg3 = Halogen_HTML_Attributes.className("col-lg-3");
var colLg2 = Halogen_HTML_Attributes.className("col-lg-2");
var colLg12 = Halogen_HTML_Attributes.className("col-lg-12");
var colLg11 = Halogen_HTML_Attributes.className("col-lg-11");
var colLg10 = Halogen_HTML_Attributes.className("col-lg-10");
var colLg1 = Halogen_HTML_Attributes.className("col-lg-1");
var close = Halogen_HTML_Attributes.className("close");
var clearfix = Halogen_HTML_Attributes.className("clearfix");
var checkboxInline = Halogen_HTML_Attributes.className("checkbox-inline");
var checkbox = Halogen_HTML_Attributes.className("checkbox");
var centerBlock = Halogen_HTML_Attributes.className("center-block");
var carouselInner = Halogen_HTML_Attributes.className("carousel-inner");
var carouselIndicators = Halogen_HTML_Attributes.className("carousel-indicators");
var carouselControl = Halogen_HTML_Attributes.className("carousel-control");
var carouselCaption = Halogen_HTML_Attributes.className("carousel-caption");
var carousel = Halogen_HTML_Attributes.className("carousel");
var caret = Halogen_HTML_Attributes.className("caret");
var caption = Halogen_HTML_Attributes.className("caption");
var btnXs = Halogen_HTML_Attributes.className("btn-xs");
var btnWarning = Halogen_HTML_Attributes.className("btn-warning");
var btnToolbar = Halogen_HTML_Attributes.className("btn-toolbar");
var btnSuccess = Halogen_HTML_Attributes.className("btn-success");
var btnSm = Halogen_HTML_Attributes.className("btn-sm");
var btnPrimary = Halogen_HTML_Attributes.className("btn-primary");
var btnLink = Halogen_HTML_Attributes.className("btn-link");
var btnLg = Halogen_HTML_Attributes.className("btn-lg");
var btnInfo = Halogen_HTML_Attributes.className("btn-info");
var btnGroupXs = Halogen_HTML_Attributes.className("btn-group-xs");
var btnGroupVertical = Halogen_HTML_Attributes.className("btn-group-vertical");
var btnGroupSm = Halogen_HTML_Attributes.className("btn-group-sm");
var btnGroupLg = Halogen_HTML_Attributes.className("btn-group-lg");
var btnGroupJustified = Halogen_HTML_Attributes.className("btn-group-justified");
var btnGroup = Halogen_HTML_Attributes.className("btn-group");
var btnDefault = Halogen_HTML_Attributes.className("btn-default");
var btnDanger = Halogen_HTML_Attributes.className("btn-danger");
var btnBlock = Halogen_HTML_Attributes.className("btn-block");
var btn = Halogen_HTML_Attributes.className("btn");
var breadcrumb = Halogen_HTML_Attributes.className("breadcrumb");
var bottomRight = Halogen_HTML_Attributes.className("bottom-right");
var bottomLeft = Halogen_HTML_Attributes.className("bottom-left");
var bottom = Halogen_HTML_Attributes.className("bottom");
var blockquoteReverse = Halogen_HTML_Attributes.className("blockquote-reverse");
var bgWarning = Halogen_HTML_Attributes.className("bg-warning");
var bgSuccess = Halogen_HTML_Attributes.className("bg-success");
var bgPrimary = Halogen_HTML_Attributes.className("bg-primary");
var bgInfo = Halogen_HTML_Attributes.className("bg-info");
var bgDanger = Halogen_HTML_Attributes.className("bg-danger");
var badge = Halogen_HTML_Attributes.className("badge");
var arrow = Halogen_HTML_Attributes.className("arrow");
var alertWarning = Halogen_HTML_Attributes.className("alert-warning");
var alertSuccess = Halogen_HTML_Attributes.className("alert-success");
var alertLink = Halogen_HTML_Attributes.className("alert-link");
var alertInfo = Halogen_HTML_Attributes.className("alert-info");
var alertDismissible = Halogen_HTML_Attributes.className("alert-dismissible");
var alertDismissable = Halogen_HTML_Attributes.className("alert-dismissable");
var alertDanger = Halogen_HTML_Attributes.className("alert-danger");
var alert = Halogen_HTML_Attributes.className("alert");
var affix = Halogen_HTML_Attributes.className("affix");
var active = Halogen_HTML_Attributes.className("active");
module.exports = {
    woff2: woff2, 
    woff: woff, 
    wellSm: wellSm, 
    wellLg: wellLg, 
    well: well, 
    warning: warning, 
    visibleXsInlineBlock: visibleXsInlineBlock, 
    visibleXsInline: visibleXsInline, 
    visibleXsBlock: visibleXsBlock, 
    visibleXs: visibleXs, 
    visibleSmInlineBlock: visibleSmInlineBlock, 
    visibleSmInline: visibleSmInline, 
    visibleSmBlock: visibleSmBlock, 
    visibleSm: visibleSm, 
    visiblePrintInlineBlock: visiblePrintInlineBlock, 
    visiblePrintInline: visiblePrintInline, 
    visiblePrintBlock: visiblePrintBlock, 
    visiblePrint: visiblePrint, 
    visibleMdInlineBlock: visibleMdInlineBlock, 
    visibleMdInline: visibleMdInline, 
    visibleMdBlock: visibleMdBlock, 
    visibleMd: visibleMd, 
    visibleLgInlineBlock: visibleLgInlineBlock, 
    visibleLgInline: visibleLgInline, 
    visibleLgBlock: visibleLgBlock, 
    visibleLg: visibleLg, 
    ttf: ttf, 
    topRight: topRight, 
    topLeft: topLeft, 
    top: top, 
    tooltipInner: tooltipInner, 
    tooltipArrow: tooltipArrow, 
    tooltip: tooltip, 
    thumbnail: thumbnail, 
    textWarning: textWarning, 
    textUppercase: textUppercase, 
    textSuccess: textSuccess, 
    textRight: textRight, 
    textPrimary: textPrimary, 
    textNowrap: textNowrap, 
    textMuted: textMuted, 
    textLowercase: textLowercase, 
    textLeft: textLeft, 
    textJustify: textJustify, 
    textInfo: textInfo, 
    textHide: textHide, 
    textDanger: textDanger, 
    textCenter: textCenter, 
    textCapitalize: textCapitalize, 
    tableStriped: tableStriped, 
    tableResponsive: tableResponsive, 
    tableHover: tableHover, 
    tableCondensed: tableCondensed, 
    tableBordered: tableBordered, 
    table: table, 
    tabPane: tabPane, 
    tabContent: tabContent, 
    svg: svg, 
    success: success, 
    srOnlyFocusable: srOnlyFocusable, 
    srOnly: srOnly, 
    small: small, 
    show_: show_, 
    row: row, 
    right: right, 
    radioInline: radioInline, 
    radio: radio, 
    pullRight: pullRight, 
    pullLeft: pullLeft, 
    progressStriped: progressStriped, 
    progressBarWarning: progressBarWarning, 
    progressBarSuccess: progressBarSuccess, 
    progressBarStriped: progressBarStriped, 
    progressBarInfo: progressBarInfo, 
    progressBarDanger: progressBarDanger, 
    progressBar: progressBar, 
    progress: progress, 
    previous: previous, 
    prev: prev, 
    preScrollable: preScrollable, 
    popoverTitle: popoverTitle, 
    popoverContent: popoverContent, 
    popover: popover, 
    panelWarning: panelWarning, 
    panelTitle: panelTitle, 
    panelSuccess: panelSuccess, 
    panelPrimary: panelPrimary, 
    panelInfo: panelInfo, 
    panelHeading: panelHeading, 
    panelGroup: panelGroup, 
    panelFooter: panelFooter, 
    panelDefault: panelDefault, 
    panelDanger: panelDanger, 
    panelCollapse: panelCollapse, 
    panelBody: panelBody, 
    panel: panel, 
    paginationSm: paginationSm, 
    paginationLg: paginationLg, 
    pagination: pagination, 
    pager: pager, 
    pageHeader: pageHeader, 
    open: open, 
    next: next, 
    navbarToggle: navbarToggle, 
    navbarText: navbarText, 
    navbarStaticTop: navbarStaticTop, 
    navbarRight: navbarRight, 
    navbarNav: navbarNav, 
    navbarLink: navbarLink, 
    navbarLeft: navbarLeft, 
    navbarInverse: navbarInverse, 
    navbarHeader: navbarHeader, 
    navbarForm: navbarForm, 
    navbarFixedTop: navbarFixedTop, 
    navbarFixedBottom: navbarFixedBottom, 
    navbarDefault: navbarDefault, 
    navbarCollapse: navbarCollapse, 
    navbarBtn: navbarBtn, 
    navbarBrand: navbarBrand, 
    navbar: navbar, 
    navTabsJustified: navTabsJustified, 
    navTabs: navTabs, 
    navStacked: navStacked, 
    navPills: navPills, 
    navJustified: navJustified, 
    navDivider: navDivider, 
    nav: nav, 
    modalTitle: modalTitle, 
    modalSm: modalSm, 
    modalScrollbarMeasure: modalScrollbarMeasure, 
    modalOpen: modalOpen, 
    modalLg: modalLg, 
    modalHeader: modalHeader, 
    modalFooter: modalFooter, 
    modalDialog: modalDialog, 
    modalContent: modalContent, 
    modalBody: modalBody, 
    modalBackdrop: modalBackdrop, 
    modal: modal, 
    mediaRight: mediaRight, 
    mediaObject: mediaObject, 
    mediaMiddle: mediaMiddle, 
    mediaList: mediaList, 
    mediaLeft: mediaLeft, 
    mediaHeading: mediaHeading, 
    mediaBottom: mediaBottom, 
    mediaBody: mediaBody, 
    media: media, 
    mark: mark, 
    listUnstyled: listUnstyled, 
    listInline: listInline, 
    listGroupItemWarning: listGroupItemWarning, 
    listGroupItemText: listGroupItemText, 
    listGroupItemSuccess: listGroupItemSuccess, 
    listGroupItemInfo: listGroupItemInfo, 
    listGroupItemHeading: listGroupItemHeading, 
    listGroupItemDanger: listGroupItemDanger, 
    listGroupItem: listGroupItem, 
    listGroup: listGroup, 
    left: left, 
    lead: lead, 
    labelWarning: labelWarning, 
    labelSuccess: labelSuccess, 
    labelPrimary: labelPrimary, 
    labelInfo: labelInfo, 
    labelDefault: labelDefault, 
    labelDanger: labelDanger, 
    label: label, 
    jumbotron: jumbotron, 
    item: item, 
    invisible: invisible, 
    inputSm: inputSm, 
    inputLg: inputLg, 
    inputGroupSm: inputGroupSm, 
    inputGroupLg: inputGroupLg, 
    inputGroupBtn: inputGroupBtn, 
    inputGroupAddon: inputGroupAddon, 
    inputGroup: inputGroup, 
    initialism: initialism, 
    info: info, 
    in_: in_, 
    imgThumbnail: imgThumbnail, 
    imgRounded: imgRounded, 
    imgResponsive: imgResponsive, 
    imgCircle: imgCircle, 
    iconPrev: iconPrev, 
    iconNext: iconNext, 
    iconBar: iconBar, 
    hide: hide, 
    hiddenXs: hiddenXs, 
    hiddenSm: hiddenSm, 
    hiddenPrint: hiddenPrint, 
    hiddenMd: hiddenMd, 
    hiddenLg: hiddenLg, 
    hidden: hidden, 
    helpBlock: helpBlock, 
    hasWarning: hasWarning, 
    hasSuccess: hasSuccess, 
    hasFeedback: hasFeedback, 
    hasError: hasError, 
    h6: h6, 
    h5: h5, 
    h4: h4, 
    h3: h3, 
    h2: h2, 
    h1: h1, 
    gradient: gradient, 
    glyphiconZoomOut: glyphiconZoomOut, 
    glyphiconZoomIn: glyphiconZoomIn, 
    glyphiconYen: glyphiconYen, 
    glyphiconWrench: glyphiconWrench, 
    glyphiconWarningSign: glyphiconWarningSign, 
    glyphiconVolumeUp: glyphiconVolumeUp, 
    glyphiconVolumeOff: glyphiconVolumeOff, 
    glyphiconVolumeDown: glyphiconVolumeDown, 
    glyphiconUser: glyphiconUser, 
    glyphiconUsd: glyphiconUsd, 
    glyphiconUpload: glyphiconUpload, 
    glyphiconUnchecked: glyphiconUnchecked, 
    glyphiconTriangleTop: glyphiconTriangleTop, 
    glyphiconTriangleRight: glyphiconTriangleRight, 
    glyphiconTriangleLeft: glyphiconTriangleLeft, 
    glyphiconTriangleBottom: glyphiconTriangleBottom, 
    glyphiconTreeDeciduous: glyphiconTreeDeciduous, 
    glyphiconTreeConifer: glyphiconTreeConifer, 
    glyphiconTrash: glyphiconTrash, 
    glyphiconTransfer: glyphiconTransfer, 
    glyphiconTower: glyphiconTower, 
    glyphiconTint: glyphiconTint, 
    glyphiconTime: glyphiconTime, 
    glyphiconThumbsUp: glyphiconThumbsUp, 
    glyphiconThumbsDown: glyphiconThumbsDown, 
    glyphiconThList: glyphiconThList, 
    glyphiconThLarge: glyphiconThLarge, 
    glyphiconTh: glyphiconTh, 
    glyphiconTextWidth: glyphiconTextWidth, 
    glyphiconTextSize: glyphiconTextSize, 
    glyphiconTextHeight: glyphiconTextHeight, 
    glyphiconTextColor: glyphiconTextColor, 
    glyphiconTextBackground: glyphiconTextBackground, 
    glyphiconTent: glyphiconTent, 
    glyphiconTasks: glyphiconTasks, 
    glyphiconTags: glyphiconTags, 
    glyphiconTag: glyphiconTag, 
    glyphiconSuperscript: glyphiconSuperscript, 
    glyphiconSunglasses: glyphiconSunglasses, 
    glyphiconSubtitles: glyphiconSubtitles, 
    glyphiconSubscript: glyphiconSubscript, 
    glyphiconStop: glyphiconStop, 
    glyphiconStepForward: glyphiconStepForward, 
    glyphiconStepBackward: glyphiconStepBackward, 
    glyphiconStats: glyphiconStats, 
    glyphiconStarEmpty: glyphiconStarEmpty, 
    glyphiconStar: glyphiconStar, 
    glyphiconSoundStereo: glyphiconSoundStereo, 
    glyphiconSoundDolby: glyphiconSoundDolby, 
    glyphiconSound7_1: glyphiconSound7_1, 
    glyphiconSound6_1: glyphiconSound6_1, 
    glyphiconSound5_1: glyphiconSound5_1, 
    glyphiconSortByOrderAlt: glyphiconSortByOrderAlt, 
    glyphiconSortByOrder: glyphiconSortByOrder, 
    glyphiconSortByAttributesAlt: glyphiconSortByAttributesAlt, 
    glyphiconSortByAttributes: glyphiconSortByAttributes, 
    glyphiconSortByAlphabetAlt: glyphiconSortByAlphabetAlt, 
    glyphiconSortByAlphabet: glyphiconSortByAlphabet, 
    glyphiconSort: glyphiconSort, 
    glyphiconSignal: glyphiconSignal, 
    glyphiconShoppingCart: glyphiconShoppingCart, 
    glyphiconShareAlt: glyphiconShareAlt, 
    glyphiconShare: glyphiconShare, 
    glyphiconSend: glyphiconSend, 
    glyphiconSearch: glyphiconSearch, 
    glyphiconSdVideo: glyphiconSdVideo, 
    glyphiconScreenshot: glyphiconScreenshot, 
    glyphiconScissors: glyphiconScissors, 
    glyphiconScale: glyphiconScale, 
    glyphiconSaved: glyphiconSaved, 
    glyphiconSaveFile: glyphiconSaveFile, 
    glyphiconSave: glyphiconSave, 
    glyphiconRuble: glyphiconRuble, 
    glyphiconRoad: glyphiconRoad, 
    glyphiconRetweet: glyphiconRetweet, 
    glyphiconResizeVertical: glyphiconResizeVertical, 
    glyphiconResizeSmall: glyphiconResizeSmall, 
    glyphiconResizeHorizontal: glyphiconResizeHorizontal, 
    glyphiconResizeFull: glyphiconResizeFull, 
    glyphiconRepeat: glyphiconRepeat, 
    glyphiconRemoveSign: glyphiconRemoveSign, 
    glyphiconRemoveCircle: glyphiconRemoveCircle, 
    glyphiconRemove: glyphiconRemove, 
    glyphiconRegistrationMark: glyphiconRegistrationMark, 
    glyphiconRefresh: glyphiconRefresh, 
    glyphiconRecord: glyphiconRecord, 
    glyphiconRandom: glyphiconRandom, 
    glyphiconQuestionSign: glyphiconQuestionSign, 
    glyphiconQueen: glyphiconQueen, 
    glyphiconQrcode: glyphiconQrcode, 
    glyphiconPushpin: glyphiconPushpin, 
    glyphiconPrint: glyphiconPrint, 
    glyphiconPlusSign: glyphiconPlusSign, 
    glyphiconPlus: glyphiconPlus, 
    glyphiconPlayCircle: glyphiconPlayCircle, 
    glyphiconPlay: glyphiconPlay, 
    glyphiconPlane: glyphiconPlane, 
    glyphiconPiggyBank: glyphiconPiggyBank, 
    glyphiconPicture: glyphiconPicture, 
    glyphiconPhoneAlt: glyphiconPhoneAlt, 
    glyphiconPhone: glyphiconPhone, 
    glyphiconPencil: glyphiconPencil, 
    glyphiconPawn: glyphiconPawn, 
    glyphiconPause: glyphiconPause, 
    glyphiconPaste: glyphiconPaste, 
    glyphiconPaperclip: glyphiconPaperclip, 
    glyphiconOptionVertical: glyphiconOptionVertical, 
    glyphiconOptionHorizontal: glyphiconOptionHorizontal, 
    glyphiconOpenFile: glyphiconOpenFile, 
    glyphiconOpen: glyphiconOpen, 
    glyphiconOkSign: glyphiconOkSign, 
    glyphiconOkCircle: glyphiconOkCircle, 
    glyphiconOk: glyphiconOk, 
    glyphiconOil: glyphiconOil, 
    glyphiconOff: glyphiconOff, 
    glyphiconObjectAlignVertical: glyphiconObjectAlignVertical, 
    glyphiconObjectAlignTop: glyphiconObjectAlignTop, 
    glyphiconObjectAlignRight: glyphiconObjectAlignRight, 
    glyphiconObjectAlignLeft: glyphiconObjectAlignLeft, 
    glyphiconObjectAlignHorizontal: glyphiconObjectAlignHorizontal, 
    glyphiconObjectAlignBottom: glyphiconObjectAlignBottom, 
    glyphiconNewWindow: glyphiconNewWindow, 
    glyphiconMusic: glyphiconMusic, 
    glyphiconMove: glyphiconMove, 
    glyphiconModalWindow: glyphiconModalWindow, 
    glyphiconMinusSign: glyphiconMinusSign, 
    glyphiconMinus: glyphiconMinus, 
    glyphiconMenuUp: glyphiconMenuUp, 
    glyphiconMenuRight: glyphiconMenuRight, 
    glyphiconMenuLeft: glyphiconMenuLeft, 
    glyphiconMenuHamburger: glyphiconMenuHamburger, 
    glyphiconMenuDown: glyphiconMenuDown, 
    glyphiconMapMarker: glyphiconMapMarker, 
    glyphiconMagnet: glyphiconMagnet, 
    glyphiconLogOut: glyphiconLogOut, 
    glyphiconLogIn: glyphiconLogIn, 
    glyphiconLock: glyphiconLock, 
    glyphiconListAlt: glyphiconListAlt, 
    glyphiconList: glyphiconList, 
    glyphiconLink: glyphiconLink, 
    glyphiconLevelUp: glyphiconLevelUp, 
    glyphiconLeaf: glyphiconLeaf, 
    glyphiconLamp: glyphiconLamp, 
    glyphiconKnight: glyphiconKnight, 
    glyphiconKing: glyphiconKing, 
    glyphiconItalic: glyphiconItalic, 
    glyphiconInfoSign: glyphiconInfoSign, 
    glyphiconIndentRight: glyphiconIndentRight, 
    glyphiconIndentLeft: glyphiconIndentLeft, 
    glyphiconInbox: glyphiconInbox, 
    glyphiconImport: glyphiconImport, 
    glyphiconIceLollyTasted: glyphiconIceLollyTasted, 
    glyphiconIceLolly: glyphiconIceLolly, 
    glyphiconHourglass: glyphiconHourglass, 
    glyphiconHome: glyphiconHome, 
    glyphiconHeartEmpty: glyphiconHeartEmpty, 
    glyphiconHeart: glyphiconHeart, 
    glyphiconHeadphones: glyphiconHeadphones, 
    glyphiconHeader: glyphiconHeader, 
    glyphiconHdd: glyphiconHdd, 
    glyphiconHdVideo: glyphiconHdVideo, 
    glyphiconHandUp: glyphiconHandUp, 
    glyphiconHandRight: glyphiconHandRight, 
    glyphiconHandLeft: glyphiconHandLeft, 
    glyphiconHandDown: glyphiconHandDown, 
    glyphiconGrain: glyphiconGrain, 
    glyphiconGlobe: glyphiconGlobe, 
    glyphiconGlass: glyphiconGlass, 
    glyphiconGift: glyphiconGift, 
    glyphiconGbp: glyphiconGbp, 
    glyphiconFullscreen: glyphiconFullscreen, 
    glyphiconForward: glyphiconForward, 
    glyphiconFont: glyphiconFont, 
    glyphiconFolderOpen: glyphiconFolderOpen, 
    glyphiconFolderClose: glyphiconFolderClose, 
    glyphiconFloppySaved: glyphiconFloppySaved, 
    glyphiconFloppySave: glyphiconFloppySave, 
    glyphiconFloppyRemove: glyphiconFloppyRemove, 
    glyphiconFloppyOpen: glyphiconFloppyOpen, 
    glyphiconFloppyDisk: glyphiconFloppyDisk, 
    glyphiconFlash: glyphiconFlash, 
    glyphiconFlag: glyphiconFlag, 
    glyphiconFire: glyphiconFire, 
    glyphiconFilter: glyphiconFilter, 
    glyphiconFilm: glyphiconFilm, 
    glyphiconFile: glyphiconFile, 
    glyphiconFastForward: glyphiconFastForward, 
    glyphiconFastBackward: glyphiconFastBackward, 
    glyphiconFacetimeVideo: glyphiconFacetimeVideo, 
    glyphiconEyeOpen: glyphiconEyeOpen, 
    glyphiconEyeClose: glyphiconEyeClose, 
    glyphiconExport: glyphiconExport, 
    glyphiconExpand: glyphiconExpand, 
    glyphiconExclamationSign: glyphiconExclamationSign, 
    glyphiconEuro: glyphiconEuro, 
    glyphiconEur: glyphiconEur, 
    glyphiconErase: glyphiconErase, 
    glyphiconEqualizer: glyphiconEqualizer, 
    glyphiconEnvelope: glyphiconEnvelope, 
    glyphiconEject: glyphiconEject, 
    glyphiconEducation: glyphiconEducation, 
    glyphiconEdit: glyphiconEdit, 
    glyphiconEarphone: glyphiconEarphone, 
    glyphiconDuplicate: glyphiconDuplicate, 
    glyphiconDownloadAlt: glyphiconDownloadAlt, 
    glyphiconDownload: glyphiconDownload, 
    glyphiconDashboard: glyphiconDashboard, 
    glyphiconCutlery: glyphiconCutlery, 
    glyphiconCreditCard: glyphiconCreditCard, 
    glyphiconCopyrightMark: glyphiconCopyrightMark, 
    glyphiconCopy: glyphiconCopy, 
    glyphiconConsole: glyphiconConsole, 
    glyphiconCompressed: glyphiconCompressed, 
    glyphiconComment: glyphiconComment, 
    glyphiconCollapseUp: glyphiconCollapseUp, 
    glyphiconCollapseDown: glyphiconCollapseDown, 
    glyphiconCog: glyphiconCog, 
    glyphiconCloudUpload: glyphiconCloudUpload, 
    glyphiconCloudDownload: glyphiconCloudDownload, 
    glyphiconCloud: glyphiconCloud, 
    glyphiconCircleArrowUp: glyphiconCircleArrowUp, 
    glyphiconCircleArrowRight: glyphiconCircleArrowRight, 
    glyphiconCircleArrowLeft: glyphiconCircleArrowLeft, 
    glyphiconCircleArrowDown: glyphiconCircleArrowDown, 
    glyphiconChevronUp: glyphiconChevronUp, 
    glyphiconChevronRight: glyphiconChevronRight, 
    glyphiconChevronLeft: glyphiconChevronLeft, 
    glyphiconChevronDown: glyphiconChevronDown, 
    glyphiconCheck: glyphiconCheck, 
    glyphiconCertificate: glyphiconCertificate, 
    glyphiconCd: glyphiconCd, 
    glyphiconCamera: glyphiconCamera, 
    glyphiconCalendar: glyphiconCalendar, 
    glyphiconBullhorn: glyphiconBullhorn, 
    glyphiconBriefcase: glyphiconBriefcase, 
    glyphiconBookmark: glyphiconBookmark, 
    glyphiconBook: glyphiconBook, 
    glyphiconBold: glyphiconBold, 
    glyphiconBlackboard: glyphiconBlackboard, 
    glyphiconBitcoin: glyphiconBitcoin, 
    glyphiconBishop: glyphiconBishop, 
    glyphiconBell: glyphiconBell, 
    glyphiconBed: glyphiconBed, 
    glyphiconBarcode: glyphiconBarcode, 
    glyphiconBanCircle: glyphiconBanCircle, 
    glyphiconBackward: glyphiconBackward, 
    glyphiconBabyFormula: glyphiconBabyFormula, 
    glyphiconAsterisk: glyphiconAsterisk, 
    glyphiconArrowUp: glyphiconArrowUp, 
    glyphiconArrowRight: glyphiconArrowRight, 
    glyphiconArrowLeft: glyphiconArrowLeft, 
    glyphiconArrowDown: glyphiconArrowDown, 
    glyphiconApple: glyphiconApple, 
    glyphiconAlignRight: glyphiconAlignRight, 
    glyphiconAlignLeft: glyphiconAlignLeft, 
    glyphiconAlignJustify: glyphiconAlignJustify, 
    glyphiconAlignCenter: glyphiconAlignCenter, 
    glyphiconAlert: glyphiconAlert, 
    glyphiconAdjust: glyphiconAdjust, 
    glyphicon: glyphicon, 
    formInline: formInline, 
    formHorizontal: formHorizontal, 
    formGroupSm: formGroupSm, 
    formGroupLg: formGroupLg, 
    formGroup: formGroup, 
    formControlStatic: formControlStatic, 
    formControlFeedback: formControlFeedback, 
    formControl: formControl, 
    focus: focus, 
    fade: fade, 
    eot: eot, 
    embedResponsiveItem: embedResponsiveItem, 
    embedResponsive4By3: embedResponsive4By3, 
    embedResponsive16By9: embedResponsive16By9, 
    embedResponsive: embedResponsive, 
    dropup: dropup, 
    dropdownToggle: dropdownToggle, 
    dropdownMenuRight: dropdownMenuRight, 
    dropdownMenuLeft: dropdownMenuLeft, 
    dropdownMenu: dropdownMenu, 
    dropdownHeader: dropdownHeader, 
    dropdownBackdrop: dropdownBackdrop, 
    dropdown: dropdown, 
    dlHorizontal: dlHorizontal, 
    divider: divider, 
    disabled: disabled, 
    danger: danger, 
    controlLabel: controlLabel, 
    containerFluid: containerFluid, 
    container: container, 
    collapsing: collapsing, 
    collapse: collapse, 
    colXsPush9: colXsPush9, 
    colXsPush8: colXsPush8, 
    colXsPush7: colXsPush7, 
    colXsPush6: colXsPush6, 
    colXsPush5: colXsPush5, 
    colXsPush4: colXsPush4, 
    colXsPush3: colXsPush3, 
    colXsPush2: colXsPush2, 
    colXsPush12: colXsPush12, 
    colXsPush11: colXsPush11, 
    colXsPush10: colXsPush10, 
    colXsPush1: colXsPush1, 
    colXsPush0: colXsPush0, 
    colXsPull9: colXsPull9, 
    colXsPull8: colXsPull8, 
    colXsPull7: colXsPull7, 
    colXsPull6: colXsPull6, 
    colXsPull5: colXsPull5, 
    colXsPull4: colXsPull4, 
    colXsPull3: colXsPull3, 
    colXsPull2: colXsPull2, 
    colXsPull12: colXsPull12, 
    colXsPull11: colXsPull11, 
    colXsPull10: colXsPull10, 
    colXsPull1: colXsPull1, 
    colXsPull0: colXsPull0, 
    colXsOffset9: colXsOffset9, 
    colXsOffset8: colXsOffset8, 
    colXsOffset7: colXsOffset7, 
    colXsOffset6: colXsOffset6, 
    colXsOffset5: colXsOffset5, 
    colXsOffset4: colXsOffset4, 
    colXsOffset3: colXsOffset3, 
    colXsOffset2: colXsOffset2, 
    colXsOffset12: colXsOffset12, 
    colXsOffset11: colXsOffset11, 
    colXsOffset10: colXsOffset10, 
    colXsOffset1: colXsOffset1, 
    colXsOffset0: colXsOffset0, 
    colXs9: colXs9, 
    colXs8: colXs8, 
    colXs7: colXs7, 
    colXs6: colXs6, 
    colXs5: colXs5, 
    colXs4: colXs4, 
    colXs3: colXs3, 
    colXs2: colXs2, 
    colXs12: colXs12, 
    colXs11: colXs11, 
    colXs10: colXs10, 
    colXs1: colXs1, 
    colSmPush9: colSmPush9, 
    colSmPush8: colSmPush8, 
    colSmPush7: colSmPush7, 
    colSmPush6: colSmPush6, 
    colSmPush5: colSmPush5, 
    colSmPush4: colSmPush4, 
    colSmPush3: colSmPush3, 
    colSmPush2: colSmPush2, 
    colSmPush12: colSmPush12, 
    colSmPush11: colSmPush11, 
    colSmPush10: colSmPush10, 
    colSmPush1: colSmPush1, 
    colSmPush0: colSmPush0, 
    colSmPull9: colSmPull9, 
    colSmPull8: colSmPull8, 
    colSmPull7: colSmPull7, 
    colSmPull6: colSmPull6, 
    colSmPull5: colSmPull5, 
    colSmPull4: colSmPull4, 
    colSmPull3: colSmPull3, 
    colSmPull2: colSmPull2, 
    colSmPull12: colSmPull12, 
    colSmPull11: colSmPull11, 
    colSmPull10: colSmPull10, 
    colSmPull1: colSmPull1, 
    colSmPull0: colSmPull0, 
    colSmOffset9: colSmOffset9, 
    colSmOffset8: colSmOffset8, 
    colSmOffset7: colSmOffset7, 
    colSmOffset6: colSmOffset6, 
    colSmOffset5: colSmOffset5, 
    colSmOffset4: colSmOffset4, 
    colSmOffset3: colSmOffset3, 
    colSmOffset2: colSmOffset2, 
    colSmOffset12: colSmOffset12, 
    colSmOffset11: colSmOffset11, 
    colSmOffset10: colSmOffset10, 
    colSmOffset1: colSmOffset1, 
    colSmOffset0: colSmOffset0, 
    colSm9: colSm9, 
    colSm8: colSm8, 
    colSm7: colSm7, 
    colSm6: colSm6, 
    colSm5: colSm5, 
    colSm4: colSm4, 
    colSm3: colSm3, 
    colSm2: colSm2, 
    colSm12: colSm12, 
    colSm11: colSm11, 
    colSm10: colSm10, 
    colSm1: colSm1, 
    colMdPush9: colMdPush9, 
    colMdPush8: colMdPush8, 
    colMdPush7: colMdPush7, 
    colMdPush6: colMdPush6, 
    colMdPush5: colMdPush5, 
    colMdPush4: colMdPush4, 
    colMdPush3: colMdPush3, 
    colMdPush2: colMdPush2, 
    colMdPush12: colMdPush12, 
    colMdPush11: colMdPush11, 
    colMdPush10: colMdPush10, 
    colMdPush1: colMdPush1, 
    colMdPush0: colMdPush0, 
    colMdPull9: colMdPull9, 
    colMdPull8: colMdPull8, 
    colMdPull7: colMdPull7, 
    colMdPull6: colMdPull6, 
    colMdPull5: colMdPull5, 
    colMdPull4: colMdPull4, 
    colMdPull3: colMdPull3, 
    colMdPull2: colMdPull2, 
    colMdPull12: colMdPull12, 
    colMdPull11: colMdPull11, 
    colMdPull10: colMdPull10, 
    colMdPull1: colMdPull1, 
    colMdPull0: colMdPull0, 
    colMdOffset9: colMdOffset9, 
    colMdOffset8: colMdOffset8, 
    colMdOffset7: colMdOffset7, 
    colMdOffset6: colMdOffset6, 
    colMdOffset5: colMdOffset5, 
    colMdOffset4: colMdOffset4, 
    colMdOffset3: colMdOffset3, 
    colMdOffset2: colMdOffset2, 
    colMdOffset12: colMdOffset12, 
    colMdOffset11: colMdOffset11, 
    colMdOffset10: colMdOffset10, 
    colMdOffset1: colMdOffset1, 
    colMdOffset0: colMdOffset0, 
    colMd9: colMd9, 
    colMd8: colMd8, 
    colMd7: colMd7, 
    colMd6: colMd6, 
    colMd5: colMd5, 
    colMd4: colMd4, 
    colMd3: colMd3, 
    colMd2: colMd2, 
    colMd12: colMd12, 
    colMd11: colMd11, 
    colMd10: colMd10, 
    colMd1: colMd1, 
    colLgPush9: colLgPush9, 
    colLgPush8: colLgPush8, 
    colLgPush7: colLgPush7, 
    colLgPush6: colLgPush6, 
    colLgPush5: colLgPush5, 
    colLgPush4: colLgPush4, 
    colLgPush3: colLgPush3, 
    colLgPush2: colLgPush2, 
    colLgPush12: colLgPush12, 
    colLgPush11: colLgPush11, 
    colLgPush10: colLgPush10, 
    colLgPush1: colLgPush1, 
    colLgPush0: colLgPush0, 
    colLgPull9: colLgPull9, 
    colLgPull8: colLgPull8, 
    colLgPull7: colLgPull7, 
    colLgPull6: colLgPull6, 
    colLgPull5: colLgPull5, 
    colLgPull4: colLgPull4, 
    colLgPull3: colLgPull3, 
    colLgPull2: colLgPull2, 
    colLgPull12: colLgPull12, 
    colLgPull11: colLgPull11, 
    colLgPull10: colLgPull10, 
    colLgPull1: colLgPull1, 
    colLgPull0: colLgPull0, 
    colLgOffset9: colLgOffset9, 
    colLgOffset8: colLgOffset8, 
    colLgOffset7: colLgOffset7, 
    colLgOffset6: colLgOffset6, 
    colLgOffset5: colLgOffset5, 
    colLgOffset4: colLgOffset4, 
    colLgOffset3: colLgOffset3, 
    colLgOffset2: colLgOffset2, 
    colLgOffset12: colLgOffset12, 
    colLgOffset11: colLgOffset11, 
    colLgOffset10: colLgOffset10, 
    colLgOffset1: colLgOffset1, 
    colLgOffset0: colLgOffset0, 
    colLg9: colLg9, 
    colLg8: colLg8, 
    colLg7: colLg7, 
    colLg6: colLg6, 
    colLg5: colLg5, 
    colLg4: colLg4, 
    colLg3: colLg3, 
    colLg2: colLg2, 
    colLg12: colLg12, 
    colLg11: colLg11, 
    colLg10: colLg10, 
    colLg1: colLg1, 
    close: close, 
    clearfix: clearfix, 
    checkboxInline: checkboxInline, 
    checkbox: checkbox, 
    centerBlock: centerBlock, 
    carouselInner: carouselInner, 
    carouselIndicators: carouselIndicators, 
    carouselControl: carouselControl, 
    carouselCaption: carouselCaption, 
    carousel: carousel, 
    caret: caret, 
    caption: caption, 
    btnXs: btnXs, 
    btnWarning: btnWarning, 
    btnToolbar: btnToolbar, 
    btnSuccess: btnSuccess, 
    btnSm: btnSm, 
    btnPrimary: btnPrimary, 
    btnLink: btnLink, 
    btnLg: btnLg, 
    btnInfo: btnInfo, 
    btnGroupXs: btnGroupXs, 
    btnGroupVertical: btnGroupVertical, 
    btnGroupSm: btnGroupSm, 
    btnGroupLg: btnGroupLg, 
    btnGroupJustified: btnGroupJustified, 
    btnGroup: btnGroup, 
    btnDefault: btnDefault, 
    btnDanger: btnDanger, 
    btnBlock: btnBlock, 
    btn: btn, 
    breadcrumb: breadcrumb, 
    bottomRight: bottomRight, 
    bottomLeft: bottomLeft, 
    bottom: bottom, 
    blockquoteReverse: blockquoteReverse, 
    bgWarning: bgWarning, 
    bgSuccess: bgSuccess, 
    bgPrimary: bgPrimary, 
    bgInfo: bgInfo, 
    bgDanger: bgDanger, 
    badge: badge, 
    arrow: arrow, 
    alertWarning: alertWarning, 
    alertSuccess: alertSuccess, 
    alertLink: alertLink, 
    alertInfo: alertInfo, 
    alertDismissible: alertDismissible, 
    alertDismissable: alertDismissable, 
    alertDanger: alertDanger, 
    alert: alert, 
    affix: affix, 
    active: active
};

},{"Halogen.HTML.Attributes":115,"Prelude":130}],127:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Halogen_Signal = require("Halogen.Signal");
var Halogen_Internal_VirtualDOM = require("Halogen.Internal.VirtualDOM");
var Prelude = require("Prelude");
var Control_Monad_Eff_Unsafe = require("Control.Monad.Eff.Unsafe");
var Halogen_HTML_Events_Monad = require("Halogen.HTML.Events.Monad");
var Debug_Trace = require("Debug.Trace");
var Control_Monad_Eff_Exception = require("Control.Monad.Eff.Exception");
var Control_Monad_Eff_Ref = require("Control.Monad.Eff.Ref");
var Halogen_HTML_Renderer_VirtualDOM = require("Halogen.HTML.Renderer.VirtualDOM");
var DOM = require("DOM");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");
var Data_Void = require("Data.Void");
var Data_Maybe = require("Data.Maybe");
var Data_Tuple = require("Data.Tuple");
var Data_Either = require("Data.Either");
var Data_Bifunctor = require("Data.Bifunctor");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Halogen_HTML = require("Halogen.HTML");
var Halogen_Component = require("Halogen.Component");
var changes = Halogen_Signal.differencesWith(Halogen_Internal_VirtualDOM.diff);
var runUIWith = function (sf) {
    return function (postRender) {
        var go = function (ref) {
            var logger = function (e) {
                return Debug_Trace.trace("Uncaught error in asynchronous code: " + Control_Monad_Eff_Exception.message(e));
            };
            var driver = function (e) {
                return function __do() {
                    var _2 = Control_Monad_Eff_Ref.readRef(ref)();
                    return (function () {
                        if (_2 instanceof Data_Maybe.Just) {
                            var next = Halogen_Signal.runSF(_2.value0.signal)(e);
                            return function __do() {
                                var _1 = Halogen_Internal_VirtualDOM.patch(Halogen_Signal.head(next))(_2.value0.node)();
                                Control_Monad_Eff_Ref.writeRef(ref)(new Data_Maybe.Just({
                                    signal: Halogen_Signal.tail(next), 
                                    node: _1
                                }))();
                                return postRender(_1)(driver)();
                            };
                        };
                        if (_2 instanceof Data_Maybe.Nothing) {
                            return Debug_Trace.trace("Error: An attempt to re-render was made during the initial render.");
                        };
                        throw new Error("Failed pattern match");
                    })()();
                };
            };
            var requestHandler = function (aff) {
                return Control_Monad_Eff_Unsafe.unsafeInterleaveEff(Halogen_HTML_Events_Monad.runEvent(logger)(driver)(aff));
            };
            var render = Halogen_HTML_Renderer_VirtualDOM.renderHTML(requestHandler);
            var vtrees = Prelude["<$>"](Halogen_Signal.functorSF1)(render)(sf);
            var node = Halogen_Internal_VirtualDOM.createElement(Halogen_Signal.head(vtrees));
            var diffs = Prelude[">>>"](Halogen_Signal.semigroupoidSF)(Halogen_Signal.tail(vtrees))(changes(Halogen_Signal.head(vtrees)));
            return function __do() {
                Control_Monad_Eff_Ref.writeRef(ref)(new Data_Maybe.Just({
                    signal: diffs, 
                    node: node
                }))();
                return new Data_Tuple.Tuple(node, driver);
            };
        };
        return function __do() {
            var _3 = Control_Monad_Eff_Ref.newRef(Data_Maybe.Nothing.value)();
            return go(_3)();
        };
    };
};
var runUI = function (sf) {
    return runUIWith(sf)(function (_19) {
        return function (_18) {
            return Prelude["return"](Control_Monad_Eff.monadEff)(Prelude.unit);
        };
    });
};
module.exports = {
    runUIWith: runUIWith, 
    runUI: runUI, 
    changes: changes
};

},{"Control.Monad.Eff":40,"Control.Monad.Eff.Exception":37,"Control.Monad.Eff.Ref":38,"Control.Monad.Eff.Unsafe":39,"DOM":59,"Data.Bifunctor":62,"Data.DOM.Simple.Types":68,"Data.Either":74,"Data.Maybe":89,"Data.Tuple":108,"Data.Void":111,"Debug.Trace":112,"Halogen.Component":114,"Halogen.HTML":122,"Halogen.HTML.Events.Monad":118,"Halogen.HTML.Renderer.VirtualDOM":121,"Halogen.Internal.VirtualDOM":123,"Halogen.Signal":124,"Prelude":130}],128:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Maybe = require("Data.Maybe");
var Data_CallNote = require("Data.CallNote");
var Data_Array = require("Data.Array");
var Data_String = require("Data.String");
var Halogen_HTML = require("Halogen.HTML");
var Halogen_HTML_Events = require("Halogen.HTML.Events");
var Halogen_Signal = require("Halogen.Signal");
var Data_DOM_Simple_Window = require("Data.DOM.Simple.Window");
var Control_Bind = require("Control.Bind");
var Data_DOM_Simple_Document = require("Data.DOM.Simple.Document");
var Data_DOM_Simple_Element = require("Data.DOM.Simple.Element");
var Halogen = require("Halogen");
var Routing = require("Routing");
var Data_Void = require("Data.Void");
var Data_Tuple = require("Data.Tuple");
var Data_Either = require("Data.Either");
var Data_DOM_Simple_Types = require("Data.DOM.Simple.Types");
var Debug_Trace = require("Debug.Trace");
var Control_Functor = require("Control.Functor");
var Control_Alternative = require("Control.Alternative");
var Control_Monad_Eff = require("Control.Monad.Eff");
var DOM = require("DOM");
var Halogen_Component = require("Halogen.Component");
var Routing_Hash = require("Routing.Hash");
var Halogen_HTML_Attributes = require("Halogen.HTML.Attributes");
var Halogen_HTML_Events_Forms = require("Halogen.HTML.Events.Forms");
var Halogen_HTML_Events_Handler = require("Halogen.HTML.Events.Handler");
var Halogen_Themes_Bootstrap3 = require("Halogen.Themes.Bootstrap3");
var Halogen_Themes_Bootstrap3_InputGroup = require("Halogen.Themes.Bootstrap3.InputGroup");
var Halogen_HTML_Events_Monad = require("Halogen.HTML.Events.Monad");
function appendToBody(node) {  return function() {    document.body.appendChild(node);  };};
var List = (function () {
    function List(value0) {
        this.value0 = value0;
    };
    List.create = function (value0) {
        return new List(value0);
    };
    return List;
})();
var Report = (function () {
    function Report(value0) {
        this.value0 = value0;
    };
    Report.create = function (value0) {
        return new Report(value0);
    };
    return Report;
})();
var Access = (function () {
    function Access(value0) {
        this.value0 = value0;
    };
    Access.create = function (value0) {
        return new Access(value0);
    };
    return Access;
})();
var New = (function () {
    function New(value0) {
        this.value0 = value0;
    };
    New.create = function (value0) {
        return new New(value0);
    };
    return New;
})();
var DoSomethingElse = (function () {
    function DoSomethingElse(value0) {
        this.value0 = value0;
    };
    DoSomethingElse.create = function (value0) {
        return new DoSomethingElse(value0);
    };
    return DoSomethingElse;
})();
var ui = function (__dict_Applicative_0) {
    var update = function (_5) {
        return function (_6) {
            if (_5 instanceof List && _5.value0 instanceof Data_Maybe.Nothing) {
                return new List(new Data_Maybe.Just(Data_CallNote.exampleCallNotes));
            };
            if (_5 instanceof Report && _5.value0 instanceof Data_Maybe.Nothing) {
                return new Report(new Data_Maybe.Just(Data_CallNote.exampleCallNotes));
            };
            if (_5 instanceof Access && _5.value0 instanceof Data_Either.Left) {
                return new Access(new Data_Either.Right(Data_CallNote.exampleCallNote));
            };
            return _6.value0;
        };
    };
    var router = function (_4) {
        if (_4 instanceof List) {
            return Halogen_HTML.div_([ Halogen_HTML.text("List") ]);
        };
        if (_4 instanceof Report) {
            return Halogen_HTML.div_([ Halogen_HTML.button([ Halogen_HTML_Events.onClick(Halogen_HTML_Events.input(__dict_Applicative_0)(function (_1) {
                return new DoSomethingElse(new New(Data_CallNote.blankCallNote));
            })) ])([ Halogen_HTML.text("New") ]) ]);
        };
        if (_4 instanceof Access) {
            return Halogen_HTML.div_([ Halogen_HTML.text("Access") ]);
        };
        if (_4 instanceof New) {
            return Halogen_HTML.div_([ Halogen_HTML.text("New") ]);
        };
        throw new Error("Failed pattern match");
    };
    var render = function (thingOurAppCanDo) {
        return Halogen_HTML.div_([ router(thingOurAppCanDo) ]);
    };
    return Prelude["<$>"](Halogen_Signal.functorSF1)(render)(Halogen_Signal.stateful(new Report(Data_Maybe.Nothing.value))(update));
};
var renderHash = function (_2) {
    if (_2 instanceof List) {
        return "/call-notes";
    };
    if (_2 instanceof Report) {
        return "/call-notes/report";
    };
    if (_2 instanceof Access && _2.value0 instanceof Data_Either.Left) {
        return "/call-notes/" + _2.value0.value0;
    };
    if (_2 instanceof Access && _2.value0 instanceof Data_Either.Right) {
        return Data_Maybe.maybe("/call-notes")(function (id_1) {
            return "/call-notes/" + id_1;
        })(_2.value0.value0.id);
    };
    if (_2 instanceof New) {
        return "/call-notes/new";
    };
    throw new Error("Failed pattern match");
};
var parseHash = (function () {
    var parse = function (_3) {
        if (_3.length === 2 && (_3[0] === "call-notes" && _3[1] === "report")) {
            return new Report(Data_Maybe.Nothing.value);
        };
        if (_3.length === 2 && (_3[0] === "call-notes" && _3[1] === "new")) {
            return new New(Data_CallNote.blankCallNote);
        };
        if (_3.length === 2 && _3[0] === "call-notes") {
            return new Access(new Data_Either.Left(_3[1]));
        };
        return new New(Data_CallNote.blankCallNote);
    };
    return Prelude["<<<"](Prelude.semigroupoidArr)(parse)(Prelude["<<<"](Prelude.semigroupoidArr)(Data_Array.drop(1))(Data_String.split("/")));
})();
var main = (function () {
    var appendToBody = function (e) {
        return Prelude[">>="](Control_Monad_Eff.bindEff)(Data_DOM_Simple_Window.document(Data_DOM_Simple_Window.htmlWindow)(Data_DOM_Simple_Window.globalWindow))(Control_Bind[">=>"](Control_Monad_Eff.bindEff)(Data_DOM_Simple_Document.body(Data_DOM_Simple_Document.htmlDocument))(Prelude.flip(Data_DOM_Simple_Element.appendChild(Data_DOM_Simple_Element.htmlElement))(e)));
    };
    return function __do() {
        var _0 = Halogen.runUI(ui(Halogen_HTML_Events_Monad.applicativeEvent))();
        appendToBody(_0.value0)();
        return Routing.hashChanged(function (oldHash) {
            return function (newHash) {
                return _0.value1(DoSomethingElse.create(parseHash(newHash)));
            };
        })();
    };
})();
module.exports = {
    DoSomethingElse: DoSomethingElse, 
    List: List, 
    Report: Report, 
    Access: Access, 
    New: New, 
    main: main, 
    appendToBody: appendToBody, 
    ui: ui, 
    parseHash: parseHash, 
    renderHash: renderHash
};

},{"Control.Alternative":27,"Control.Bind":29,"Control.Functor":32,"Control.Monad.Eff":40,"DOM":59,"Data.Array":61,"Data.CallNote":63,"Data.DOM.Simple.Document":66,"Data.DOM.Simple.Element":67,"Data.DOM.Simple.Types":68,"Data.DOM.Simple.Window":73,"Data.Either":74,"Data.Maybe":89,"Data.String":106,"Data.Tuple":108,"Data.Void":111,"Debug.Trace":112,"Halogen":127,"Halogen.Component":114,"Halogen.HTML":122,"Halogen.HTML.Attributes":115,"Halogen.HTML.Events":120,"Halogen.HTML.Events.Forms":116,"Halogen.HTML.Events.Handler":117,"Halogen.HTML.Events.Monad":118,"Halogen.Signal":124,"Halogen.Themes.Bootstrap3":126,"Halogen.Themes.Bootstrap3.InputGroup":125,"Prelude":130,"Routing":137,"Routing.Hash":131}],129:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");

    function unsafeIndex(xs) {
      return function(n) {
        return xs[n];
      };
    }
    ;
module.exports = {
    unsafeIndex: unsafeIndex
};

},{"Prelude":130}],130:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";

    function cons(e) {
      return function(l) {
        return [e].concat(l);
      };
    }
    ;

    function showStringImpl(s) {
      return JSON.stringify(s);
    }
    ;

    function showNumberImpl(n) {
      return n.toString();
    }
    ;

    function showArrayImpl(f) {
      return function(xs) {
        var ss = [];
        for (var i = 0, l = xs.length; i < l; i++) {
          ss[i] = f(xs[i]);
        }
        return '[' + ss.join(',') + ']';
      };
    }
    ;

    function numAdd(n1) {
      return function(n2) {
        return n1 + n2;
      };
    }
    ;

    function numSub(n1) {
      return function(n2) {
        return n1 - n2;
      };
    }
    ;

    function numMul(n1) {
      return function(n2) {
        return n1 * n2;
      };
    }
    ;

    function numDiv(n1) {
      return function(n2) {
        return n1 / n2;
      };
    }
    ;

    function numMod(n1) {
      return function(n2) {
        return n1 % n2;
      };
    }
    ;

    function refEq(r1) {
      return function(r2) {
        return r1 === r2;
      };
    }
    ;

    function refIneq(r1) {
      return function(r2) {
        return r1 !== r2;
      };
    }
    ;

    function eqArrayImpl(f) {
      return function(xs) {
        return function(ys) {
          if (xs.length !== ys.length) return false;
          for (var i = 0; i < xs.length; i++) {
            if (!f(xs[i])(ys[i])) return false;
          }
          return true;
        };
      };
    }
    ;

    function unsafeCompareImpl(lt) {
      return function(eq) {
        return function(gt) {
          return function(x) {
            return function(y) {
              return x < y ? lt : x > y ? gt : eq;
            };
          };
        };
      };
    }
    ;

    function numShl(n1) {
      return function(n2) {
        return n1 << n2;
      };
    }
    ;

    function numShr(n1) {
      return function(n2) {
        return n1 >> n2;
      };
    }
    ;

    function numZshr(n1) {
      return function(n2) {
        return n1 >>> n2;
      };
    }
    ;

    function numAnd(n1) {
      return function(n2) {
        return n1 & n2;
      };
    }
    ;

    function numOr(n1) {
      return function(n2) {
        return n1 | n2;
      };
    }
    ;

    function numXor(n1) {
      return function(n2) {
        return n1 ^ n2;
      };
    }
    ;

    function numComplement(n) {
      return ~n;
    }
    ;

    function boolAnd(b1) {
      return function(b2) {
        return b1 && b2;
      };
    }
    ;

    function boolOr(b1) {
      return function(b2) {
        return b1 || b2;
      };
    }
    ;

    function boolNot(b) {
      return !b;
    }
    ;

    function concatString(s1) {
      return function(s2) {
        return s1 + s2;
      };
    }
    ;
var Unit = function (x) {
    return x;
};
var LT = (function () {
    function LT() {

    };
    LT.value = new LT();
    return LT;
})();
var GT = (function () {
    function GT() {

    };
    GT.value = new GT();
    return GT;
})();
var EQ = (function () {
    function EQ() {

    };
    EQ.value = new EQ();
    return EQ;
})();
var Semigroupoid = function ($less$less$less) {
    this["<<<"] = $less$less$less;
};
var Category = function (__superclass_Prelude$dotSemigroupoid_0, id) {
    this["__superclass_Prelude.Semigroupoid_0"] = __superclass_Prelude$dotSemigroupoid_0;
    this.id = id;
};
var Show = function (show) {
    this.show = show;
};
var Functor = function ($less$dollar$greater) {
    this["<$>"] = $less$dollar$greater;
};
var Apply = function ($less$times$greater, __superclass_Prelude$dotFunctor_0) {
    this["<*>"] = $less$times$greater;
    this["__superclass_Prelude.Functor_0"] = __superclass_Prelude$dotFunctor_0;
};
var Applicative = function (__superclass_Prelude$dotApply_0, pure) {
    this["__superclass_Prelude.Apply_0"] = __superclass_Prelude$dotApply_0;
    this.pure = pure;
};
var Bind = function ($greater$greater$eq, __superclass_Prelude$dotApply_0) {
    this[">>="] = $greater$greater$eq;
    this["__superclass_Prelude.Apply_0"] = __superclass_Prelude$dotApply_0;
};
var Monad = function (__superclass_Prelude$dotApplicative_0, __superclass_Prelude$dotBind_1) {
    this["__superclass_Prelude.Applicative_0"] = __superclass_Prelude$dotApplicative_0;
    this["__superclass_Prelude.Bind_1"] = __superclass_Prelude$dotBind_1;
};
var Semiring = function ($times, $plus, one, zero) {
    this["*"] = $times;
    this["+"] = $plus;
    this.one = one;
    this.zero = zero;
};
var ModuloSemiring = function ($div, __superclass_Prelude$dotSemiring_0, mod) {
    this["/"] = $div;
    this["__superclass_Prelude.Semiring_0"] = __superclass_Prelude$dotSemiring_0;
    this.mod = mod;
};
var Ring = function ($minus, __superclass_Prelude$dotSemiring_0) {
    this["-"] = $minus;
    this["__superclass_Prelude.Semiring_0"] = __superclass_Prelude$dotSemiring_0;
};
var DivisionRing = function (__superclass_Prelude$dotModuloSemiring_1, __superclass_Prelude$dotRing_0) {
    this["__superclass_Prelude.ModuloSemiring_1"] = __superclass_Prelude$dotModuloSemiring_1;
    this["__superclass_Prelude.Ring_0"] = __superclass_Prelude$dotRing_0;
};
var Num = function (__superclass_Prelude$dotDivisionRing_0) {
    this["__superclass_Prelude.DivisionRing_0"] = __superclass_Prelude$dotDivisionRing_0;
};
var Eq = function ($div$eq, $eq$eq) {
    this["/="] = $div$eq;
    this["=="] = $eq$eq;
};
var Ord = function (__superclass_Prelude$dotEq_0, compare) {
    this["__superclass_Prelude.Eq_0"] = __superclass_Prelude$dotEq_0;
    this.compare = compare;
};
var Bits = function ($dot$amp$dot, $dot$up$dot, $dot$bar$dot, complement, shl, shr, zshr) {
    this[".&."] = $dot$amp$dot;
    this[".^."] = $dot$up$dot;
    this[".|."] = $dot$bar$dot;
    this.complement = complement;
    this.shl = shl;
    this.shr = shr;
    this.zshr = zshr;
};
var BoolLike = function ($amp$amp, not, $bar$bar) {
    this["&&"] = $amp$amp;
    this.not = not;
    this["||"] = $bar$bar;
};
var Semigroup = function ($less$greater) {
    this["<>"] = $less$greater;
};
var $bar$bar = function (dict) {
    return dict["||"];
};
var $greater$greater$eq = function (dict) {
    return dict[">>="];
};
var $eq$eq = function (dict) {
    return dict["=="];
};
var $less$greater = function (dict) {
    return dict["<>"];
};
var $less$less$less = function (dict) {
    return dict["<<<"];
};
var $greater$greater$greater = function (__dict_Semigroupoid_0) {
    return function (f) {
        return function (g) {
            return $less$less$less(__dict_Semigroupoid_0)(g)(f);
        };
    };
};
var $less$times$greater = function (dict) {
    return dict["<*>"];
};
var $less$dollar$greater = function (dict) {
    return dict["<$>"];
};
var $less$hash$greater = function (__dict_Functor_1) {
    return function (fa) {
        return function (f) {
            return $less$dollar$greater(__dict_Functor_1)(f)(fa);
        };
    };
};
var $colon = cons;
var $div$eq = function (dict) {
    return dict["/="];
};
var $div = function (dict) {
    return dict["/"];
};
var $dot$bar$dot = function (dict) {
    return dict[".|."];
};
var $dot$up$dot = function (dict) {
    return dict[".^."];
};
var $dot$amp$dot = function (dict) {
    return dict[".&."];
};
var $minus = function (dict) {
    return dict["-"];
};
var $plus$plus = function (__dict_Semigroup_2) {
    return $less$greater(__dict_Semigroup_2);
};
var $plus = function (dict) {
    return dict["+"];
};
var $times = function (dict) {
    return dict["*"];
};
var $amp$amp = function (dict) {
    return dict["&&"];
};
var $percent = numMod;
var $dollar = function (f) {
    return function (x) {
        return f(x);
    };
};
var $hash = function (x) {
    return function (f) {
        return f(x);
    };
};
var zshr = function (dict) {
    return dict.zshr;
};
var zero = function (dict) {
    return dict.zero;
};
var unsafeCompare = unsafeCompareImpl(LT.value)(EQ.value)(GT.value);
var unit = {};
var shr = function (dict) {
    return dict.shr;
};
var showUnit = new Show(function (_64) {
    return "Unit {}";
});
var showString = new Show(showStringImpl);
var showOrdering = new Show(function (_74) {
    if (_74 instanceof LT) {
        return "LT";
    };
    if (_74 instanceof GT) {
        return "GT";
    };
    if (_74 instanceof EQ) {
        return "EQ";
    };
    throw new Error("Failed pattern match");
});
var showNumber = new Show(showNumberImpl);
var showBoolean = new Show(function (_65) {
    if (_65) {
        return "true";
    };
    if (!_65) {
        return "false";
    };
    throw new Error("Failed pattern match");
});
var show = function (dict) {
    return dict.show;
};
var showArray = function (__dict_Show_3) {
    return new Show(showArrayImpl(show(__dict_Show_3)));
};
var shl = function (dict) {
    return dict.shl;
};
var semiringNumber = new Semiring(numMul, numAdd, 1, 0);
var semigroupoidArr = new Semigroupoid(function (f) {
    return function (g) {
        return function (x) {
            return f(g(x));
        };
    };
});
var semigroupUnit = new Semigroup(function (_82) {
    return function (_83) {
        return {};
    };
});
var semigroupString = new Semigroup(concatString);
var semigroupOrdering = new Semigroup(function (_75) {
    return function (y) {
        if (_75 instanceof LT) {
            return LT.value;
        };
        if (_75 instanceof GT) {
            return GT.value;
        };
        if (_75 instanceof EQ) {
            return y;
        };
        throw new Error("Failed pattern match");
    };
});
var semigroupArr = function (__dict_Semigroup_4) {
    return new Semigroup(function (f) {
        return function (g) {
            return function (x) {
                return $less$greater(__dict_Semigroup_4)(f(x))(g(x));
            };
        };
    });
};
var ringNumber = new Ring(numSub, function () {
    return semiringNumber;
});
var pure = function (dict) {
    return dict.pure;
};
var $$return = function (__dict_Monad_5) {
    return pure(__dict_Monad_5["__superclass_Prelude.Applicative_0"]());
};
var otherwise = true;
var one = function (dict) {
    return dict.one;
};
var not = function (dict) {
    return dict.not;
};
var negate = function (__dict_Ring_6) {
    return function (a) {
        return $minus(__dict_Ring_6)(zero(__dict_Ring_6["__superclass_Prelude.Semiring_0"]()))(a);
    };
};
var moduloSemiringNumber = new ModuloSemiring(numDiv, function () {
    return semiringNumber;
}, function (_66) {
    return function (_67) {
        return 0;
    };
});
var mod = function (dict) {
    return dict.mod;
};
var liftM1 = function (__dict_Monad_7) {
    return function (f) {
        return function (a) {
            return $greater$greater$eq(__dict_Monad_7["__superclass_Prelude.Bind_1"]())(a)(function (_1) {
                return $$return(__dict_Monad_7)(f(_1));
            });
        };
    };
};
var liftA1 = function (__dict_Applicative_8) {
    return function (f) {
        return function (a) {
            return $less$times$greater(__dict_Applicative_8["__superclass_Prelude.Apply_0"]())(pure(__dict_Applicative_8)(f))(a);
        };
    };
};
var id = function (dict) {
    return dict.id;
};
var functorArr = new Functor($less$less$less(semigroupoidArr));
var flip = function (f) {
    return function (b) {
        return function (a) {
            return f(a)(b);
        };
    };
};
var eqUnit = new Eq(function (_70) {
    return function (_71) {
        return false;
    };
}, function (_68) {
    return function (_69) {
        return true;
    };
});
var ordUnit = new Ord(function () {
    return eqUnit;
}, function (_76) {
    return function (_77) {
        return EQ.value;
    };
});
var eqString = new Eq(refIneq, refEq);
var ordString = new Ord(function () {
    return eqString;
}, unsafeCompare);
var eqNumber = new Eq(refIneq, refEq);
var ordNumber = new Ord(function () {
    return eqNumber;
}, unsafeCompare);
var eqBoolean = new Eq(refIneq, refEq);
var ordBoolean = new Ord(function () {
    return eqBoolean;
}, function (_78) {
    return function (_79) {
        if (!_78 && !_79) {
            return EQ.value;
        };
        if (!_78 && _79) {
            return LT.value;
        };
        if (_78 && _79) {
            return EQ.value;
        };
        if (_78 && !_79) {
            return GT.value;
        };
        throw new Error("Failed pattern match");
    };
});
var divisionRingNumber = new DivisionRing(function () {
    return moduloSemiringNumber;
}, function () {
    return ringNumber;
});
var numNumber = new Num(function () {
    return divisionRingNumber;
});
var $$const = function (a) {
    return function (_62) {
        return a;
    };
};
var $$void = function (__dict_Functor_10) {
    return function (fa) {
        return $less$dollar$greater(__dict_Functor_10)($$const(unit))(fa);
    };
};
var complement = function (dict) {
    return dict.complement;
};
var compare = function (dict) {
    return dict.compare;
};
var $less = function (__dict_Ord_12) {
    return function (a1) {
        return function (a2) {
            var _802 = compare(__dict_Ord_12)(a1)(a2);
            if (_802 instanceof LT) {
                return true;
            };
            return false;
        };
    };
};
var $less$eq = function (__dict_Ord_13) {
    return function (a1) {
        return function (a2) {
            var _803 = compare(__dict_Ord_13)(a1)(a2);
            if (_803 instanceof GT) {
                return false;
            };
            return true;
        };
    };
};
var $greater = function (__dict_Ord_14) {
    return function (a1) {
        return function (a2) {
            var _804 = compare(__dict_Ord_14)(a1)(a2);
            if (_804 instanceof GT) {
                return true;
            };
            return false;
        };
    };
};
var $greater$eq = function (__dict_Ord_15) {
    return function (a1) {
        return function (a2) {
            var _805 = compare(__dict_Ord_15)(a1)(a2);
            if (_805 instanceof LT) {
                return false;
            };
            return true;
        };
    };
};
var categoryArr = new Category(function () {
    return semigroupoidArr;
}, function (x) {
    return x;
});
var boolLikeBoolean = new BoolLike(boolAnd, boolNot, boolOr);
var eqArray = function (__dict_Eq_9) {
    return new Eq(function (xs) {
        return function (ys) {
            return not(boolLikeBoolean)($eq$eq(eqArray(__dict_Eq_9))(xs)(ys));
        };
    }, function (xs) {
        return function (ys) {
            return eqArrayImpl($eq$eq(__dict_Eq_9))(xs)(ys);
        };
    });
};
var ordArray = function (__dict_Ord_11) {
    return new Ord(function () {
        return eqArray(__dict_Ord_11["__superclass_Prelude.Eq_0"]());
    }, function (_80) {
        return function (_81) {
            if (_80.length === 0 && _81.length === 0) {
                return EQ.value;
            };
            if (_80.length === 0) {
                return LT.value;
            };
            if (_81.length === 0) {
                return GT.value;
            };
            if (_80.length >= 1) {
                var _812 = _80.slice(1);
                if (_81.length >= 1) {
                    var _810 = _81.slice(1);
                    var _808 = compare(__dict_Ord_11)(_80[0])(_81[0]);
                    if (_808 instanceof EQ) {
                        return compare(ordArray(__dict_Ord_11))(_812)(_810);
                    };
                    return _808;
                };
            };
            throw new Error("Failed pattern match");
        };
    });
};
var eqOrdering = new Eq(function (x) {
    return function (y) {
        return not(boolLikeBoolean)($eq$eq(eqOrdering)(x)(y));
    };
}, function (_72) {
    return function (_73) {
        if (_72 instanceof LT && _73 instanceof LT) {
            return true;
        };
        if (_72 instanceof GT && _73 instanceof GT) {
            return true;
        };
        if (_72 instanceof EQ && _73 instanceof EQ) {
            return true;
        };
        return false;
    };
});
var bitsNumber = new Bits(numAnd, numXor, numOr, numComplement, numShl, numShr, numZshr);
var asTypeOf = function (x) {
    return function (_63) {
        return x;
    };
};
var applyArr = new Apply(function (f) {
    return function (g) {
        return function (x) {
            return f(x)(g(x));
        };
    };
}, function () {
    return functorArr;
});
var bindArr = new Bind(function (m) {
    return function (f) {
        return function (x) {
            return f(m(x))(x);
        };
    };
}, function () {
    return applyArr;
});
var applicativeArr = new Applicative(function () {
    return applyArr;
}, $$const);
var monadArr = new Monad(function () {
    return applicativeArr;
}, function () {
    return bindArr;
});
var ap = function (__dict_Monad_16) {
    return function (f) {
        return function (a) {
            return $greater$greater$eq(__dict_Monad_16["__superclass_Prelude.Bind_1"]())(f)(function (_3) {
                return $greater$greater$eq(__dict_Monad_16["__superclass_Prelude.Bind_1"]())(a)(function (_2) {
                    return $$return(__dict_Monad_16)(_3(_2));
                });
            });
        };
    };
};
module.exports = {
    Unit: Unit, 
    LT: LT, 
    GT: GT, 
    EQ: EQ, 
    Semigroup: Semigroup, 
    BoolLike: BoolLike, 
    Bits: Bits, 
    Ord: Ord, 
    Eq: Eq, 
    Num: Num, 
    DivisionRing: DivisionRing, 
    Ring: Ring, 
    ModuloSemiring: ModuloSemiring, 
    Semiring: Semiring, 
    Monad: Monad, 
    Bind: Bind, 
    Applicative: Applicative, 
    Apply: Apply, 
    Functor: Functor, 
    Show: Show, 
    Category: Category, 
    Semigroupoid: Semigroupoid, 
    unit: unit, 
    "++": $plus$plus, 
    "<>": $less$greater, 
    not: not, 
    "||": $bar$bar, 
    "&&": $amp$amp, 
    complement: complement, 
    zshr: zshr, 
    shr: shr, 
    shl: shl, 
    ".^.": $dot$up$dot, 
    ".|.": $dot$bar$dot, 
    ".&.": $dot$amp$dot, 
    ">=": $greater$eq, 
    "<=": $less$eq, 
    ">": $greater, 
    "<": $less, 
    compare: compare, 
    "/=": $div$eq, 
    "==": $eq$eq, 
    negate: negate, 
    "%": $percent, 
    "-": $minus, 
    mod: mod, 
    "/": $div, 
    one: one, 
    "*": $times, 
    zero: zero, 
    "+": $plus, 
    ap: ap, 
    liftM1: liftM1, 
    "return": $$return, 
    ">>=": $greater$greater$eq, 
    liftA1: liftA1, 
    pure: pure, 
    "<*>": $less$times$greater, 
    "void": $$void, 
    "<#>": $less$hash$greater, 
    "<$>": $less$dollar$greater, 
    show: show, 
    cons: cons, 
    ":": $colon, 
    "#": $hash, 
    "$": $dollar, 
    id: id, 
    ">>>": $greater$greater$greater, 
    "<<<": $less$less$less, 
    asTypeOf: asTypeOf, 
    "const": $$const, 
    flip: flip, 
    otherwise: otherwise, 
    semigroupoidArr: semigroupoidArr, 
    categoryArr: categoryArr, 
    showUnit: showUnit, 
    showString: showString, 
    showBoolean: showBoolean, 
    showNumber: showNumber, 
    showArray: showArray, 
    functorArr: functorArr, 
    applyArr: applyArr, 
    applicativeArr: applicativeArr, 
    bindArr: bindArr, 
    monadArr: monadArr, 
    semiringNumber: semiringNumber, 
    ringNumber: ringNumber, 
    moduloSemiringNumber: moduloSemiringNumber, 
    divisionRingNumber: divisionRingNumber, 
    numNumber: numNumber, 
    eqUnit: eqUnit, 
    eqString: eqString, 
    eqNumber: eqNumber, 
    eqBoolean: eqBoolean, 
    eqArray: eqArray, 
    eqOrdering: eqOrdering, 
    showOrdering: showOrdering, 
    semigroupOrdering: semigroupOrdering, 
    ordUnit: ordUnit, 
    ordBoolean: ordBoolean, 
    ordNumber: ordNumber, 
    ordString: ordString, 
    ordArray: ordArray, 
    bitsNumber: bitsNumber, 
    boolLikeBoolean: boolLikeBoolean, 
    semigroupUnit: semigroupUnit, 
    semigroupString: semigroupString, 
    semigroupArr: semigroupArr
};

},{}],131:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Monad_Eff = require("Control.Monad.Eff");
var DOM = require("DOM");

function setHash(hash) {
  return function() {
    var uri = document.location.href.split('#')[0];
    document.location.href = uri + '#' + hash;
  };
}
;

function getHash() {
  return document.location.href.split('#').splice(1).join('#');
}
;
var modifyHash = function (fn) {
    return Prelude[">>="](Control_Monad_Eff.bindEff)(Prelude["<$>"](Control_Monad_Eff.functorEff)(fn)(getHash))(setHash);
};
module.exports = {
    modifyHash: modifyHash, 
    getHash: getHash, 
    setHash: setHash
};

},{"Control.Monad.Eff":40,"DOM":59,"Prelude":130}],132:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Control_Alternative = require("Control.Alternative");
var MatchClass = function (__superclass_Control$dotAlternative$dotAlternative_0, bool, fail, lit, num, param, str) {
    this["__superclass_Control.Alternative.Alternative_0"] = __superclass_Control$dotAlternative$dotAlternative_0;
    this.bool = bool;
    this.fail = fail;
    this.lit = lit;
    this.num = num;
    this.param = param;
    this.str = str;
};
var str = function (dict) {
    return dict.str;
};
var param = function (dict) {
    return dict.param;
};
var num = function (dict) {
    return dict.num;
};
var lit = function (dict) {
    return dict.lit;
};
var fail = function (dict) {
    return dict.fail;
};
var bool = function (dict) {
    return dict.bool;
};
module.exports = {
    MatchClass: MatchClass, 
    fail: fail, 
    bool: bool, 
    num: num, 
    param: param, 
    str: str, 
    lit: lit
};

},{"Control.Alternative":27,"Prelude":130}],133:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var UnexpectedPath = (function () {
    function UnexpectedPath(value0) {
        this.value0 = value0;
    };
    UnexpectedPath.create = function (value0) {
        return new UnexpectedPath(value0);
    };
    return UnexpectedPath;
})();
var ExpectedBoolean = (function () {
    function ExpectedBoolean() {

    };
    ExpectedBoolean.value = new ExpectedBoolean();
    return ExpectedBoolean;
})();
var ExpectedNumber = (function () {
    function ExpectedNumber() {

    };
    ExpectedNumber.value = new ExpectedNumber();
    return ExpectedNumber;
})();
var ExpectedString = (function () {
    function ExpectedString() {

    };
    ExpectedString.value = new ExpectedString();
    return ExpectedString;
})();
var ExpectedQuery = (function () {
    function ExpectedQuery() {

    };
    ExpectedQuery.value = new ExpectedQuery();
    return ExpectedQuery;
})();
var ExpectedPathPart = (function () {
    function ExpectedPathPart() {

    };
    ExpectedPathPart.value = new ExpectedPathPart();
    return ExpectedPathPart;
})();
var KeyNotFound = (function () {
    function KeyNotFound(value0) {
        this.value0 = value0;
    };
    KeyNotFound.create = function (value0) {
        return new KeyNotFound(value0);
    };
    return KeyNotFound;
})();
var Fail = (function () {
    function Fail(value0) {
        this.value0 = value0;
    };
    Fail.create = function (value0) {
        return new Fail(value0);
    };
    return Fail;
})();
var showMatchError = function (err) {
    if (err instanceof UnexpectedPath) {
        return "expected path part: " + err.value0;
    };
    if (err instanceof KeyNotFound) {
        return "key: " + (err.value0 + " has not found in query part");
    };
    if (err instanceof ExpectedQuery) {
        return "expected query - found path";
    };
    if (err instanceof ExpectedNumber) {
        return "expected number";
    };
    if (err instanceof ExpectedBoolean) {
        return "expected boolean";
    };
    if (err instanceof ExpectedString) {
        return "expected string var";
    };
    if (err instanceof ExpectedPathPart) {
        return "expected path part, found query";
    };
    if (err instanceof Fail) {
        return "match error: " + err.value0;
    };
    throw new Error("Failed pattern match");
};
module.exports = {
    UnexpectedPath: UnexpectedPath, 
    ExpectedBoolean: ExpectedBoolean, 
    ExpectedNumber: ExpectedNumber, 
    ExpectedString: ExpectedString, 
    ExpectedQuery: ExpectedQuery, 
    ExpectedPathPart: ExpectedPathPart, 
    KeyNotFound: KeyNotFound, 
    Fail: Fail, 
    showMatchError: showMatchError
};

},{"Prelude":130}],134:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_Validation_Semiring = require("Data.Validation.Semiring");
var Data_Semiring_Free = require("Data.Semiring.Free");
var Global = require("Global");
var Data_StrMap = require("Data.StrMap");
var Control_Alt = require("Control.Alt");
var Data_List = require("Data.List");
var Data_Foldable = require("Data.Foldable");
var Data_Array = require("Data.Array");
var Routing_Match_Error = require("Routing.Match.Error");
var Data_Tuple = require("Data.Tuple");
var Data_Either = require("Data.Either");
var Data_Maybe = require("Data.Maybe");
var Control_Plus = require("Control.Plus");
var Control_Apply = require("Control.Apply");
var Control_Alternative = require("Control.Alternative");
var Control_Monad_Error = require("Control.Monad.Error");
var Routing_Parser = require("Routing.Parser");
var Routing_Types = require("Routing.Types");
var Routing_Match_Class = require("Routing.Match.Class");
var Match = function (x) {
    return x;
};
var runMatch = function (_766) {
    return function (route) {
        var foldErrors = function (errs) {
            return Data_Either.Left.create(Data_Foldable.foldl(Data_Foldable.foldableArray)(function (b) {
                return function (a) {
                    return a + ("\n" + b);
                };
            })("")(Prelude[">>="](Data_Array.bindArray)(Prelude["<$>"](Data_Array.functorArray)(Data_Array.reverse)(Data_Semiring_Free.runFree(errs)))(function (_60) {
                return Prelude.pure(Data_Array.applicativeArray)(Data_Foldable.foldl(Data_Foldable.foldableArray)(function (b) {
                    return function (a) {
                        return a + (";" + b);
                    };
                })("")(Prelude["<$>"](Data_Array.functorArray)(Routing_Match_Error.showMatchError)(_60)));
            })));
        };
        return Data_Validation_Semiring.runV(foldErrors)(Prelude["<<<"](Prelude.semigroupoidArr)(Data_Either.Right.create)(Data_Tuple.snd))(_766(route));
    };
};
var matchFunctor = new Prelude.Functor(function (fn) {
    return function (_768) {
        return Match(function (r) {
            return Data_Validation_Semiring.runV(Data_Validation_Semiring.invalid)(function (_762) {
                return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(_762.value0, fn(_762.value1)));
            })(_768(r));
        });
    };
});
var matchApply = new Prelude.Apply(function (_771) {
    return function (_772) {
        var processFnRes = function (_773) {
            return Data_Validation_Semiring.runV(Data_Validation_Semiring.invalid)(function (_763) {
                return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(_763.value0, _773.value1(_763.value1)));
            })(_772(_773.value0));
        };
        var processFnErr = function (r) {
            return function (err) {
                return Data_Validation_Semiring.invalid(Prelude["*"](Data_Semiring_Free.semiringFree)(err)(Data_Validation_Semiring.runV(Prelude.id(Prelude.categoryArr))(Prelude["const"](Prelude.one(Data_Semiring_Free.semiringFree)))(_772(r))));
            };
        };
        return Match(function (r) {
            return Data_Validation_Semiring.runV(processFnErr(r))(processFnRes)(_771(r));
        });
    };
}, function () {
    return matchFunctor;
});
var matchApplicative = new Prelude.Applicative(function () {
    return matchApply;
}, function (a) {
    return function (r) {
        return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(r, a));
    };
});
var matchAlt = new Control_Alt.Alt(function (_769) {
    return function (_770) {
        return Match(function (r) {
            return Control_Alt["<|>"](Data_Validation_Semiring.altV(Data_Semiring_Free.semiringFree))(_769(r))(_770(r));
        });
    };
}, function () {
    return matchFunctor;
});
var matchPlus = new Control_Plus.Plus(function () {
    return matchAlt;
}, Match(Prelude["const"](Data_Validation_Semiring.invalid(Prelude.one(Data_Semiring_Free.semiringFree)))));
var matchAlternative = new Control_Alternative.Alternative(function () {
    return matchPlus;
}, function () {
    return matchApplicative;
});
var matchMatchClass = new Routing_Match_Class.MatchClass(function () {
    return matchAlternative;
}, Match(function (route) {
    if (route instanceof Data_List.Cons && (route.value0 instanceof Routing_Types.Path && route.value0.value0 === "true")) {
        return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(route.value1, true));
    };
    if (route instanceof Data_List.Cons && (route.value0 instanceof Routing_Types.Path && route.value0.value0 === "false")) {
        return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(route.value1, false));
    };
    return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(Routing_Match_Error.ExpectedBoolean.value));
}), function (msg) {
    return function (_761) {
        return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(new Routing_Match_Error.Fail(msg)));
    };
}, function (input) {
    return Match(function (route) {
        if (route instanceof Data_List.Cons && (route.value0 instanceof Routing_Types.Path && route.value0.value0 === input)) {
            return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(route.value1, Prelude.unit));
        };
        if (route instanceof Data_List.Cons && route.value0 instanceof Routing_Types.Path) {
            return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(new Routing_Match_Error.UnexpectedPath(input)));
        };
        return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(Routing_Match_Error.ExpectedPathPart.value));
    });
}, Match(function (route) {
    if (route instanceof Data_List.Cons && route.value0 instanceof Routing_Types.Path) {
        var res = Global.readFloat(route.value0.value0);
        var _3215 = Global.isNaN(res);
        if (_3215) {
            return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(Routing_Match_Error.ExpectedNumber.value));
        };
        if (!_3215) {
            return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(route.value1, res));
        };
        throw new Error("Failed pattern match");
    };
    return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(Routing_Match_Error.ExpectedNumber.value));
}), function (key) {
    return Match(function (route) {
        if (route instanceof Data_List.Cons && route.value0 instanceof Routing_Types.Query) {
            var _3220 = Data_StrMap.lookup(key)(route.value0.value0);
            if (_3220 instanceof Data_Maybe.Nothing) {
                return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(new Routing_Match_Error.KeyNotFound(key)));
            };
            if (_3220 instanceof Data_Maybe.Just) {
                return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(new Data_List.Cons(Prelude["<<<"](Prelude.semigroupoidArr)(Routing_Types.Query.create)(Data_StrMap["delete"](key))(route.value0.value0), route.value1), _3220.value0));
            };
            throw new Error("Failed pattern match");
        };
        return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(Routing_Match_Error.ExpectedQuery.value));
    });
}, Match(function (route) {
    if (route instanceof Data_List.Cons && route.value0 instanceof Routing_Types.Path) {
        return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(route.value1, route.value0.value0));
    };
    return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(Routing_Match_Error.ExpectedString.value));
}));
var list = function (_765) {
    var go = function (accum) {
        return function (r) {
            return Data_Validation_Semiring.runV(Prelude["const"](Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(r, Data_List.reverse(accum)))))(function (_764) {
                return go(new Data_List.Cons(_764.value1, accum))(_764.value0);
            })(_765(r));
        };
    };
    return Match(go(Data_List.Nil.value));
};
var eitherMatch = function (_767) {
    var runEither = function (_774) {
        if (_774.value1 instanceof Data_Either.Left) {
            return Data_Validation_Semiring.invalid(Data_Semiring_Free.free(new Routing_Match_Error.Fail("Nested check failed")));
        };
        if (_774.value1 instanceof Data_Either.Right) {
            return Prelude.pure(Data_Validation_Semiring.applicativeV(Data_Semiring_Free.semiringFree))(new Data_Tuple.Tuple(_774.value0, _774.value1.value0));
        };
        throw new Error("Failed pattern match");
    };
    return Match(function (r) {
        return Data_Validation_Semiring.runV(Data_Validation_Semiring.invalid)(runEither)(_767(r));
    });
};
module.exports = {
    Match: Match, 
    eitherMatch: eitherMatch, 
    runMatch: runMatch, 
    list: list, 
    matchMatchClass: matchMatchClass, 
    matchFunctor: matchFunctor, 
    matchAlt: matchAlt, 
    matchPlus: matchPlus, 
    matchAlternative: matchAlternative, 
    matchApply: matchApply, 
    matchApplicative: matchApplicative
};

},{"Control.Alt":26,"Control.Alternative":27,"Control.Apply":28,"Control.Monad.Error":43,"Control.Plus":58,"Data.Array":61,"Data.Either":74,"Data.Foldable":76,"Data.List":88,"Data.Maybe":89,"Data.Semiring.Free":101,"Data.StrMap":103,"Data.Tuple":108,"Data.Validation.Semiring":110,"Global":113,"Prelude":130,"Routing.Match.Class":132,"Routing.Match.Error":133,"Routing.Parser":135,"Routing.Types":136}],135:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_String = require("Data.String");
var Prelude = require("Prelude");
var Control_MonadPlus = require("Control.MonadPlus");
var Data_Array = require("Data.Array");
var Data_Maybe = require("Data.Maybe");
var Data_StrMap = require("Data.StrMap");
var Data_Traversable = require("Data.Traversable");
var Data_List = require("Data.List");
var Data_Tuple = require("Data.Tuple");
var Routing_Types = require("Routing.Types");
var tryQuery = function (_732) {
    if (_732 instanceof Routing_Types.Path) {
        var part2tuple = function (input) {
            var keyVal = Data_String.split("=")(input);
            return Prelude[">>="](Data_Maybe.bindMaybe)(Control_MonadPlus.guard(Data_Maybe.monadPlusMaybe)(Data_Array.length(keyVal) <= 2))(function () {
                return Prelude["<*>"](Data_Maybe.applyMaybe)(Prelude["<$>"](Data_Maybe.functorMaybe)(Data_Tuple.Tuple.create)(Data_Array.head(keyVal)))(Data_Array["!!"](keyVal)(1));
            });
        };
        return Data_Maybe.fromMaybe(_732)(Prelude[">>="](Data_Maybe.bindMaybe)(Control_MonadPlus.guard(Data_Maybe.monadPlusMaybe)(Data_String.take(1)(_732.value0) === "?"))(function () {
            var parts = Data_String.split("&")(Data_String.drop(1)(_732.value0));
            return Prelude["<$>"](Data_Maybe.functorMaybe)(Prelude["<$>"](Prelude.functorArr)(Routing_Types.Query.create)(Data_StrMap.fromList))(Data_Traversable.traverse(Data_Traversable.traversableArray)(Data_Maybe.applicativeMaybe)(part2tuple)(parts));
        }));
    };
    return _732;
};
var parse = function (decoder) {
    return function (hash) {
        return Prelude["<$>"](Data_List.functorList)(Prelude["<$>"](Prelude.functorArr)(Prelude["<$>"](Prelude.functorArr)(tryQuery)(Routing_Types.Path.create))(decoder))(Data_List.fromArray(Data_String.split("/")(hash)));
    };
};
module.exports = {
    parse: parse
};

},{"Control.MonadPlus":57,"Data.Array":61,"Data.List":88,"Data.Maybe":89,"Data.StrMap":103,"Data.String":106,"Data.Traversable":107,"Data.Tuple":108,"Prelude":130,"Routing.Types":136}],136:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Prelude = require("Prelude");
var Data_StrMap = require("Data.StrMap");
var Data_List = require("Data.List");
var Path = (function () {
    function Path(value0) {
        this.value0 = value0;
    };
    Path.create = function (value0) {
        return new Path(value0);
    };
    return Path;
})();
var Query = (function () {
    function Query(value0) {
        this.value0 = value0;
    };
    Query.create = function (value0) {
        return new Query(value0);
    };
    return Query;
})();
module.exports = {
    Path: Path, 
    Query: Query
};

},{"Data.List":88,"Data.StrMap":103,"Prelude":130}],137:[function(require,module,exports){
// Generated by psc-make version 0.6.9.5
"use strict";
var Data_String_Regex = require("Data.String.Regex");
var Prelude = require("Prelude");
var Data_Either = require("Data.Either");
var Control_Monad_Aff = require("Control.Monad.Aff");
var Routing_Match = require("Routing.Match");
var Routing_Parser = require("Routing.Parser");
var Control_Monad_Eff = require("Control.Monad.Eff");
var Data_Maybe = require("Data.Maybe");
var Data_Tuple = require("Data.Tuple");

function hashChanged(handler) {
  return function() {
    var getHash = function() {
      return document.location.href.split('#').splice(1).join('#');
    };
    var oldHash = "";    
    handler("")(getHash())();
    window.addEventListener("hashchange", function(ev) {
      var newHash = getHash();
      handler(oldHash)(newHash)();
      oldHash = newHash;
    });
  };
}
;
var matchHash$prime = function (decoder) {
    return function (matcher) {
        return function (hash) {
            return Routing_Match.runMatch(matcher)(Routing_Parser.parse(decoder)(hash));
        };
    };
};
var matchHash = matchHash$prime(decodeURIComponent);
var hashes = function (cb) {
    var dropHash = function (h) {
        return Data_String_Regex.replace(Data_String_Regex.regex("^[^#]*#")(Data_String_Regex.noFlags))("")(h);
    };
    return hashChanged(function (old) {
        return function ($$new) {
            return cb(dropHash(old))(dropHash($$new));
        };
    });
};
var matches$prime = function (decoder) {
    return function (routing) {
        return function (cb) {
            return hashes(function (old) {
                return function ($$new) {
                    var mr = matchHash$prime(decoder)(routing);
                    var fst = Data_Either.either(Prelude["const"](Data_Maybe.Nothing.value))(Data_Maybe.Just.create)(mr(old));
                    return Data_Either.either(Prelude["const"](Prelude.pure(Control_Monad_Eff.applicativeEff)(Prelude.unit)))(cb(fst))(mr($$new));
                };
            });
        };
    };
};
var matches = matches$prime(decodeURIComponent);
var matchesAff$prime = function (decoder) {
    return function (routing) {
        return Control_Monad_Aff.makeAff(function (_775) {
            return function (k) {
                return matches$prime(decoder)(routing)(function (old) {
                    return function ($$new) {
                        return k(new Data_Tuple.Tuple(old, $$new));
                    };
                });
            };
        });
    };
};
var matchesAff = matchesAff$prime(decodeURIComponent);
module.exports = {
    "matchesAff'": matchesAff$prime, 
    matchesAff: matchesAff, 
    "matchHash'": matchHash$prime, 
    matchHash: matchHash, 
    "matches'": matches$prime, 
    matches: matches, 
    hashes: hashes, 
    hashChanged: hashChanged
};

},{"Control.Monad.Aff":35,"Control.Monad.Eff":40,"Data.Either":74,"Data.Maybe":89,"Data.String.Regex":104,"Data.Tuple":108,"Prelude":130,"Routing.Match":134,"Routing.Parser":135}],138:[function(require,module,exports){
require('Main').main();

},{"Main":128}]},{},[138]);
