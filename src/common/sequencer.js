//jshint esversion: 6

let sequence = 0;

function sequencer(prefix) {
    if(prefix!==undefined && prefix!==null)
        return `${prefix}-${++sequence}`;
    else
        return ++sequence;
}