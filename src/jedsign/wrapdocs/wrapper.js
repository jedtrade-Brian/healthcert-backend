const {parentPort, workerData} = require("worker_threads");
const { wrapDocument, wrapDocuments, getData } = require('@govtechsg/open-attestation');
const fs = require('fs');

parentPort.on("message", (data) => {
    const documents = data.rawJSONArr.map((document) => wrapDocument(document));
    parentPort.postMessage({id: data.id, result: documents});
});