var app = angular.module('kubjaringi', ['ui.bootstrap', 'ngRoute', 'rx', 'ui.checkbox', 'angularNumberPicker']);

app.config(['$routeProvider',
  function ($routeProvider) {
    $routeProvider.
        when('/temperature', {
          templateUrl: 'partials/temperature.html',
          controller: 'TemperatureCtrl'
        }).
        when('/remote', {
          templateUrl: 'partials/remote.html',
          controller: 'RemoteCtrl'
        }).
        otherwise({
          redirectTo: '/temperature'
        });
  }]);

app.directive('activeLink', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var path = element.children("a").attr("href");
      var clazz = attrs.activeLink;
      path = path.substring(1);
      scope.$on('$locationChangeStart', function (event, newPath) {
        if (path === newPath.split("#")[1]) {
          element.addClass(clazz);
        } else {
          element.removeClass(clazz);
        }
      });
    }
  };
});

