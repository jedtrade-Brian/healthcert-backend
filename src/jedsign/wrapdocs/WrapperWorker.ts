const EventEmitter = require('events');
const { Worker, isMainThread, parentPort } = require('worker_threads');

export class WrapperWorker {
  id: string;
  //worker = new Worker(`./src/profiler/wrapper.js`);
  worker = new Worker(`./src/jedsign/wrapdocs/wrapper.js`);
  emitter = new EventEmitter();
  output = [];

  constructor(id: string) {
    this.id = id;

    this.worker.on('message', data => {
      this.output = data.result;
      this.emitter.emit('done');
    });

    this.worker.on('error', error => {
      console.log('Wrapper: ', error);
    });

    this.worker.on('exit', exitCode => {});
  }
}
