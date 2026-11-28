//<reference path="./app.js"/>
declare namespace app {
  export namespace event {
    function on(eventName: string, callback: (...args: any[]) => void): void;

    function off(eventName: string): void;

    function trigger(eventName: string, ...args: any[]): void;

    var _callbacks: any;
  }
}
