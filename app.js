const { MongodbPersistence } = require("y-mongodb-provider");
const WebSocket = require('ws');
const { setPersistence, setupWSConnection } = require("./wsServer/utils");
const Y = require("yjs");

// Load environment variables from .env file
const mongodb_host = process.env.MONGODB_HOST || 'mongodb://127.0.0.1:27017';
const host = process.env.WEBSOCKETS_DOMAIN || '127.0.0.1';
const port = process.env.WEBSOCKETS_PORT || 2403;

// Create a MongoDB persistence instance
const mdb = new MongodbPersistence(mongodb_host, {
    collectionName: "transactions",
    flushSize: 100,
    multipleCollections: true
});

// Set up the persistence layer for Yjs documents
setPersistence({
    bindState: async (docName, ydoc) => {
        try {
            // Retrieve the persisted Yjs document from the database
            const persistedYdoc = await mdb.getYDoc(docName);

            // Encode the current state of the Yjs document
            const newUpdates = Y.encodeStateAsUpdate(ydoc);

            // Store the new updates in the database
            await mdb.storeUpdate(docName, newUpdates);

            // Apply the persisted updates to the current Yjs document
            Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));

            // Listen for updates to the Yjs document and store them in the database
            ydoc.on('update', async update => {
                try {
                    await mdb.storeUpdate(docName, update);
                } catch (err) {
                    console.error(`Error storing update for document "${docName}":`, err);
                }
            });
        } catch (err) {
            console.error(`Error binding state for document "${docName}":`, err);
        }
    },
    writeState: async (docName, ydoc) => {
        try {
            // This is called when all connections to the document are closed.
            // Ensure the document is written to the database before resolving.
            return new Promise(resolve => {
                // Simulate writing the document to the database
                resolve();
            });
        } catch (err) {
            console.error(`Error writing state for document "${docName}":`, err);
        }
    }
})

// Create a WebSocket server
// This is the server that will be used to synchronise the clients
// among themselves and to persist the data in the database
const wss = new WebSocket.Server({ port: port });

wss.on('connection', async (conn, req, options) => {
    // Invoke the original setupWSConnection
    let yDoc = setupWSConnection(conn, req, options);
    //  yDoc.on('update', (update) => {
    //      console.log(yDoc.getText().toString().concat("\n\n"));
    //  });

    // Send the Y.Doc instance to the client
    conn.send(JSON.stringify({ type: 'yDoc', yDoc: yDoc.toJSON() }));

    console.log("Connection set");
});

