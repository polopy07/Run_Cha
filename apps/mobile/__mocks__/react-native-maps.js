const React = require('react');
const { View } = require('react-native');

const MockMapView = (props) => React.createElement(View, props);
const MockMarker = (props) => React.createElement(View, props);
const MockPolygon = (props) => React.createElement(View, props);

MockMapView.Marker = MockMarker;
MockMapView.Polygon = MockPolygon;

module.exports = MockMapView;
module.exports.default = MockMapView;
module.exports.Marker = MockMarker;
module.exports.Polygon = MockPolygon;
module.exports.PROVIDER_GOOGLE = 'google';
