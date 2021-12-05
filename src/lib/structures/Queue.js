

class Queue {
    constructor(arr = []) {
      this.arr = arr;
    }
  
    push(item) {
      if (Array.isArray(item)) {
        this.arr.push(...item);
      } else {
        this.arr.push(item);
      }
    }
  
    pop() {
      return this.arr.shift();
    }
  
    peek() {
      return this.arr[0];
    }
  
    get length() {
      return this.arr.length;
    }
  
    copy() {
      return new Queue([...this.arr]);
    }
  }

  module.exports = Queue;