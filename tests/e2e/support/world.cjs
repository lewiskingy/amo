const { setWorldConstructor, World } = require('@cucumber/cucumber');

class AmoWorld extends World {
  constructor(options){
    super(options);
    this.browser=null;
    this.context=null;
    this.page=null;
    this.browserErrors=[];
  }
}

setWorldConstructor(AmoWorld);
