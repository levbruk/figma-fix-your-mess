// Plugin message types
const MessageType = {
    Init: "Init",
    UserID: "UserID",
    Result: "Result",
    Scan: "Scan",
    Zoom: "Zoom",
    ZoomCantFind: "ZoomCantFind",
    ZoomFound: "ZoomFound",
    SelectionChanged: "SelectionChanged",
    ClosePlugin: "ClosePlugin"
}

// Client storage types
const ClientStorageKey = {
    userID: "userID"
}

// Data types
type NodeData = {
    name: string
    id: string
    type: string
}

// Scan result
type ScanResult = {
    framesMatchesFound: Array<NodeData>
    instancesFoundTotal: number
    nodesTotal: number
    time: number
    fastEnough: boolean
}



export {
    MessageType,
    ClientStorageKey,
    NodeData,
    ScanResult
}