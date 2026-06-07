const generatePin = () => {
  // Generates a random number between 10000 and 99999
  return Math.floor(10000 + Math.random() * 90000).toString();
};

module.exports = generatePin;
