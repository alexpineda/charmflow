
class Stack {
    constructor(arr = []) {
      this.arr = arr;
    }
  
    push(item) {
      if (Array.isArray(item)) {
        this.arr.unshift(...item);
      } else {
        this.arr.unshift(item);
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
      return new Stack([...this.arr]);
    }
  }

  module.exports = Stack;