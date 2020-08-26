import './figma-ds/figma-plugin-ds.min.css'
import './figma-ds/figma-plugin-ds.min.js'
import './ui.css'
import { MessageType, NodeData, ScanResult } from "./common"



// Mixpanel Analytics
import * as mixpanel from 'mixpanel-figma'
import { MIXPANEL_API_KEY } from './private'
(function () {
  mixpanel.init(MIXPANEL_API_KEY, {
    disable_cookie: true,
    disable_persistence: true
  })
  parent.postMessage({
    pluginMessage: {
      type: MessageType.UserID
    }
  }, '*')
})()



// Messages
const MessageText = {
  Onboarding: "Scan to find detached instances",
  Done: "Nothing found. Lucky you!",
}



// Initialize objects
let header = <HTMLDivElement>document.getElementById("header")
let headerArtwork = <HTMLDivElement>document.getElementById("artwork")
let headerArtworkBack = <HTMLDivElement>document.getElementById("artwork-back")
let resultContainer = <HTMLDivElement>document.getElementById("result-container")
let textMessage = <HTMLParagraphElement>document.getElementById("text-message")
let content = <HTMLDivElement>document.getElementById("content")
let tipBottom = <HTMLDivElement>document.getElementById("tip-bottom")
let scanButton = <HTMLInputElement>document.getElementById("scan")



// Keyboard shortcuts
// Works only when window is focused
document.addEventListener('keyup', function (event) {
  if (event.defaultPrevented) {
    return
  }
  var key = event.key || event.keyCode
  //console.log("Key pressed: ", event.key, event.keyCode)

  if (key === 'Escape' || key === 'Esc' || key === 27) {

    // Track Closing by pressing Escape key
    mixpanel.track("Close Plugin", { "Trigger": "Escape" })

    setTimeout(() => {
      parent.postMessage({
        pluginMessage: {
          type: MessageType.ClosePlugin
        }
      }, '*')
    }, 1000)
  }

  if (key === 'Enter' || key === 13) {

    // Track Scanning by pressing Enter key
    mixpanel.track("Scan Start", { "Trigger": "Enter" })

    tryScan()
  }
})

// Focus on button so user can press Enter right after plugin was launched
scanButton.focus() 



textMessage.innerText = MessageText.Onboarding // Set onboarding text



// When UI recieve message from Figma
onmessage = (event) => {
  let message = event.data.pluginMessage
  //console.log("Plugin Message: ", msg)
  switch (message.type) {

    // Analytics
    case MessageType.UserID:
      let userID = message.id
      //console.log("User ID: " + userID)

      mixpanel.identify(userID) // Identify user
      if (message.firstTime) {
        // Add user ID to user profile
        mixpanel.people.set({ "USER_ID": userID })
      }

      // Track plugin launch
      mixpanel.track("Plugin Launch")
      break

    // Scan result
    case MessageType.Result:

      scanningInProgress = false

      let result: ScanResult = message.data

      // Track result matches total and scan time
      mixpanel.track("Scan Result", { "Detached Instances Found": result.framesMatchesFound.length, "Scan Time": result.time })

      // Hide notification about slow loading
      let tipBottom = <HTMLDivElement>document.getElementById("tip-bottom")
      if (result.fastEnough) {
        // Hide tip immediately
        tipBottom.className = "tip-bottom hidden"
      } else {
        // Hide tip with delay
        tipBottom.className = "tip-bottom hide"
      }

      // Clear list
      var range = document.createRange()
      range.selectNodeContents(resultContainer)
      range.deleteContents()

      // Fade in
      content.classList.replace("opacity-04", "opacity-1")

      // Check if anything was found
      if (result.framesMatchesFound.length > 0) {
        // Found something

        // Add title and counter
        let instancesFoundLabel = <HTMLDivElement>(document.createElement('div'))
        instancesFoundLabel.className = "label"
        instancesFoundLabel.innerHTML = "Detached instances"

        let instancesFoundCounter = <HTMLSpanElement>(document.createElement('span'))
        instancesFoundLabel.appendChild(instancesFoundCounter)
        resultContainer.appendChild(instancesFoundLabel)

        // Set counter
        instancesFoundCounter.className = "badge-counter bad"
        instancesFoundCounter.innerHTML = result.framesMatchesFound.length.toString()

        // Set header and hide text
        headerArtwork.className = "artwork main"
        header.classList.replace("large", "small")
        headerArtworkBack.classList.replace("opacity-0", "opacity-1")
        headerArtworkBack.classList.replace("no-delay", "delay")
        textMessage.style.setProperty("display", "none")

        // Sort layers alphabetically
        result.framesMatchesFound.sort(compareValues('name'))

        // Create div for each found node
        let instancesFoundNodes = <HTMLDivElement>(document.createElement('div'))
        for (let i = 0; i < result.framesMatchesFound.length; i++) {

          let node = result.framesMatchesFound[i]

          let listElementInstance = <HTMLDivElement>document.createElement("div")
          listElementInstance.className = "layer__row"

          let listElementIcon = <HTMLDivElement>document.createElement("div")
          listElementIcon.className = "layer__icon icon--frame"
          listElementInstance.appendChild(listElementIcon)

          let listElementName = <HTMLDivElement>document.createElement("div")
          listElementName.className = "layer__name layer--top-level"
          listElementName.innerHTML = node.name
          listElementInstance.appendChild(listElementName)

          listElementInstance.id = node.id
          instancesFoundNodes.appendChild(listElementInstance)

          // Zoom to node in Figma when layer is selected
          listElementInstance.addEventListener("click", function () {
            parent.postMessage({
              pluginMessage: {
                type: MessageType.Zoom,
                id: node.id
              }
            }, '*')
          })
        }

        // Append nodes list
        resultContainer.append(instancesFoundNodes)

        // Activate layer if it was already selected
        updateSelections(message.selectedLayerId)

        // Scroll down a little
        //content.scrollIntoView({ behavior: "smooth", block: "start" })

      } else {
        // Nothing found

        // Set header and hide text
        headerArtwork.className = "artwork done"
        header.classList.replace("small", "large")
        headerArtworkBack.classList.replace("opacity-1", "opacity-0")
        headerArtworkBack.classList.replace("delay", "no-delay")
        textMessage.innerText = MessageText.Done
        textMessage.classList.replace("opacity-0", "opacity-1")
        textMessage.style.setProperty("display", "block")

      }

      // Reactivate scan button
      let scanButton = <HTMLInputElement>document.getElementById("scan")
      scanButton.disabled = false
      scanButton.innerHTML = "Scan Again"

      // Hide spinner
      let scanSpinner = <HTMLDivElement>document.getElementById("scan-spinner")
      scanSpinner.style.display = "none"

      break


    // Selection changed
    case MessageType.SelectionChanged:
      let selectedElementId = message.id
      updateSelections(selectedElementId)
      break

    // Layer found
    case MessageType.ZoomFound:
      // Track selection not found
      mixpanel.track("Select From List", { "Found": true })
      break

    // Layer not found
    case MessageType.ZoomCantFind:
      // Track selection not found
      mixpanel.track("Select From List", { "Found": false })

      //console.log(layersList)
      const layer = <HTMLHtmlElement>document.getElementById(message.id)
      if (layer) {
        layer.getElementsByClassName("layer__name layer--top-level")[0].className = "layer__name layer--top-level done"
      }
      break

  }
}



// Scan button action
document.getElementById("scan").onclick = (event) => {
  // Track scan button
  mixpanel.track("Scan Start", { "Trigger": "Scan Button" })
  tryScan()
}



let scanningInProgress = false

function tryScan() {
  if (!scanningInProgress) {
    scanningInProgress = true

    //let scanButton = <HTMLInputElement>event.target
    let scanSpinner = document.getElementById("scan-spinner")
    scanSpinner.style.display = "block"
    scanButton.disabled = true
    scanButton.innerHTML = "Working..."

    tipBottom.classList.replace("hidden", "delayed")
    textMessage.classList.replace("opacity-1", "opacity-0")

    // Fade content
    content.classList.replace("opacity-1", "opacity-04")

    setTimeout(() => {
      parent.postMessage({
        pluginMessage: {
          //settings: settingsUI,
          type: MessageType.Scan
        }
      }, '*')
    }, 1000)

  }
}



// Update selected layers styles in list
function updateSelections(selectedElementId: string) {
  // Deactivate previous layers in list
  var layersWithSelectedState = document.getElementsByClassName("layer__row selected")
  for (var i = layersWithSelectedState.length - 1; i >= 0; --i) {
    layersWithSelectedState[i].className = "layer__row"
  }

  if (selectedElementId) {
    // Activate selected layer
    const layerToSelect = <HTMLHtmlElement>document.getElementById(selectedElementId)
    if (layerToSelect) {
      layerToSelect.className = "layer__row selected"
      layerToSelect.getElementsByClassName("layer__name layer--top-level")[0].className = "layer__name layer--top-level"
    }
  }
}



// Extentions & tools

// Compare values & sort
function compareValues(key, order = 'asc') {
  return function innerSort(a, b) {
    if (!a.hasOwnProperty(key) || !b.hasOwnProperty(key)) {
      // property doesn't exist on either object
      return 0
    }
    const varA = (typeof a[key] === 'string')
      ? a[key].toUpperCase() : a[key]
    const varB = (typeof b[key] === 'string')
      ? b[key].toUpperCase() : b[key]

    let comparison = 0
    if (varA > varB) {
      comparison = 1
    } else if (varA < varB) {
      comparison = -1
    }
    return (
      (order === 'desc') ? (comparison * -1) : comparison
    )
  }
}
