import { MessageType, NodeData, ScanResult, ClientStorageKey } from "./common"



// Show Plugin Window
figma.showUI(__html__, {
  width: 288,
  height: 480
})



// Messages
const NotificationText = {
  NotThereAnymore: "This one is gone"
}



// When a message is received from the UI
figma.ui.onmessage = async (message) => {
  //console.log("Message", msg)
  switch (message.type) {

    // User ID for analytics
    case MessageType.UserID:
      getAndPostUserId()
      break

    // Scan button pressed
    case MessageType.Scan:

      let scanResult: ScanResult = await scanDocument()

      // Send result to UI
      figma.ui.postMessage({
        data: scanResult,
        type: MessageType.Result
      })
      postNewSelection()

      break

    // Focus on selected node
    case MessageType.Zoom:

      let node: (BaseNode | FrameNode)
      if (node = figma.getNodeById(message.id) as FrameNode) {
        figma.ui.postMessage({
          id: message.id,
          type: MessageType.ZoomFound,
        })
        focusOnNode(node)
      } else {
        figma.ui.postMessage({
          id: message.id,
          type: MessageType.ZoomCantFind,
        })
        figma.notify(NotificationText.NotThereAnymore)
      }
      break

    // Close plugin on Escape key
    case MessageType.ClosePlugin:
      figma.closePlugin()
      break

    default:
      break
  }
}



// Selection changed
let postNewSelection = () => {

  let selection: ReadonlyArray<SceneNode> = figma.currentPage.selection
  let selectedFrameId = null
  if (selection.length == 1 && selection[0].type === "FRAME") {
    selectedFrameId = selection[0].id
  }
  figma.ui.postMessage({
    id: selectedFrameId,
    type: MessageType.SelectionChanged,
  })
}
figma.on('selectionchange', postNewSelection)



// Scan document
async function scanDocument() {

  // Start the traversal at the root
  let scanResult: ScanResult = findDetachedInstances(figma.root)
  return scanResult
}



// Find detached instances
function findDetachedInstances(node: any) {

  let componentsFound: Array<String> = []
  let instancesFound: Array<String> = []
  let framesFound: Array<NodeData> = []
  let framesMatchesFound: Array<NodeData> = []
  let nodesFoundTotal = 0

  // Traverse
  let traverse = function crawl(node: any) {
    nodesFoundTotal++

    if ("children" in node) {

      if (node.type === "FRAME") {
        framesFound.push({
          name: node.name,
          id: node.id,
          type: node.type
        })

      } else if (node.type === "INSTANCE") {
        instancesFound.push(node.name)
        return

      } else if (node.type === "COMPONENT") {
        componentsFound.push(node.name)
        instancesFound.push(node.name)
        return
      }

      // Crawl further if node has children
      if (node.type === "GROUP" || node.type === "FRAME" || node.type === "PAGE" || node.type === "DOCUMENT") {
        for (const child of node.children) {
          crawl(child)
        }
      } else {
        return
      }
    }
  }

  measureTime(Timer.Start) // Start counter

  traverse(figma.root) // Oh boy! Here we go scanning

  // Compare names of found frames and components
  framesFound.forEach(node => {
    const found = instancesFound.find(function (element) {
      // Return frame if it has the same name as one of the found components
      return element === node.name
    })
    if (found) {
      // Add found node to array
      framesMatchesFound.push({
        name: node.name,
        id: node.id,
        type: node.type
      })
    }
  })

  //console.log("Found nodes: " + nodesFoundTotal)
  //console.log("Found instances: " + instancesFound.length)
  //console.log("Found detached instances: " + framesMatchesFound.length)

  let time = measureTime(Timer.Stop) // Stop counter to measure time
  let fastEnough = true
  if (time > 5) {
    // Scanning took too long
    fastEnough = false
  }

  let scanResult: ScanResult = {
    framesMatchesFound: framesMatchesFound,
    instancesFoundTotal: instancesFound.length,
    nodesTotal: nodesFoundTotal,
    time: time,
    fastEnough: fastEnough
  }

  return scanResult
}



// Focus on selected element
function focusOnNode(node: (FrameNode)) {
  //console.log("Focusing on node", node)

  // Find the page where the selected node is
  let parentNode: BaseNode = node
  while (parentNode && parentNode.type !== 'PAGE') {
    parentNode = parentNode.parent
  }
  // Focus on the page with the selected node
  if (parentNode.type === "PAGE" && parentNode != figma.currentPage) {
    figma.currentPage = parentNode
  }

  figma.currentPage.selection = [node]

  // Check if the node is inside the viewport and it's zoomed in
  let vx = figma.viewport.bounds.x
  let vx2 = vx + figma.viewport.bounds.width
  let nx = node.absoluteTransform[0][2]
  let nx2 = nx + node.width
  let vy = figma.viewport.bounds.y
  let vy2 = vy + figma.viewport.bounds.height
  let ny = node.absoluteTransform[1][2]
  let ny2 = ny + node.height

  let isInsideViewport: boolean
  if ((vx > nx) || (vx2 < nx2) || (vy > ny) || (vy2 < ny2)) {
    isInsideViewport = false
  } else {
    isInsideViewport = true
  }
  if (!isInsideViewport || (isInsideViewport && figma.viewport.zoom < 0.5)) {
    // If the node is outside of the viewport or if it's inside but zoomed out too much  
    figma.viewport.scrollAndZoomIntoView([node])
  }
}



// Get user ID from client storage for analytics
const getAndPostUserId = async () => {
  //console.log("Getting user ID")
  const newUserID = createUUID()
  try {
    const userID = await figma.clientStorage.getAsync(ClientStorageKey.userID)
    if (typeof userID === 'undefined') {
      // No user ID in client storage
      figma.clientStorage.setAsync(ClientStorageKey.userID, newUserID).then(() => {
        // Saved new user ID in client storage
        postUserID(newUserID, true) // Send new user ID to UI
      })
    } else {
      // Found user ID in client storage
      postUserID(userID, false) // Send found user ID to UI
    }
  } catch (e) {
    // Can't retrieve user ID from client storage
    //console.error('Error retrieving user ID', e)
    figma.clientStorage.setAsync(ClientStorageKey.userID, newUserID).then(() => {
      postUserID(newUserID, true) // Send new user ID to UI
    })
  }
}

function postUserID(userID: string, firstTime: boolean) {
  figma.ui.postMessage({
    id: userID,
    firstTime: firstTime,
    type: MessageType.UserID
  })
}

// Create unique ID for new user
const createUUID = () => {
  var dt = new Date().getTime()
  var mask = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  var uuid = mask.replace(/[xy]/g, function (c) {
    var r = (dt + Math.random() * 16) % 16 | 0
    dt = Math.floor(dt / 16)
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
  return uuid
}



// Extentions & tools

// Measure execution time
var measureTimeDate: number
const Timer = {
  Start: "Start",
  Stop: "Stop",
}
function measureTime(resetTimer: String) {
  if (!measureTimeDate) {
    measureTimeDate = new Date().getTime()
  }

  switch (resetTimer) {
    case Timer.Start:
      measureTimeDate = new Date().getTime()
      return

    case Timer.Stop:
      let end = new Date().getTime()
      let time = Number(((end - measureTimeDate) / 1000).toFixed(2)) // Time in seconds
      //console.log("Took " + time + " sec.")
      return time
  }
}



// npx webpack --mode=development --watch
// npx webpack --mode=production

