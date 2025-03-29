// Height Width calculations for video frames
const getVideoHeight = (NO_OF_PARTICIPANTS) => {
    if (NO_OF_PARTICIPANTS <= 2) {
        return 100;
    } else if (NO_OF_PARTICIPANTS <= 8) {
        return 50;
    } else {
        return 33.33;
    }
};

const getVideoWidth = (NO_OF_PARTICIPANTS) => {
    if (NO_OF_PARTICIPANTS == 1) {
        return 100;
    } else if (NO_OF_PARTICIPANTS <= 4) {
        return 50;
    } else if (NO_OF_PARTICIPANTS <= 6) {
        return 33.33;
    } else {
        return 25;
    }
};

module.exports = { getVideoHeight, getVideoWidth };
