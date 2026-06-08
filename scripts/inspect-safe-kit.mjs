import Safe from '@safe-global/protocol-kit';

console.log("Safe class properties:", Object.getOwnPropertyNames(Safe));
console.log("Safe prototype properties:", Object.getOwnPropertyNames(Safe.prototype || {}));
const safeInstanceProto = Safe.prototype;
if (safeInstanceProto) {
  const methods = Object.getOwnPropertyNames(safeInstanceProto).filter(m => typeof safeInstanceProto[m] === 'function');
  console.log("Safe methods:", methods);
}
