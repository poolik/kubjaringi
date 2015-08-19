app.controller('AppCtrl', ['$scope', '$http', function($scope, $http) {
  $scope.status = "badge-danger";
  $http.get('/status').then(function () {
    $scope.status = "badge-success";
  })
}]);

app.controller('TemperatureCtrl', ['$scope', '$http', 'TempChart',
  function ($scope, $http, TempChart) {
    var defaultChart = {id: "24h", name: "24h"};
    $scope.chartTypes = [{id:"3h", name:"3h"}, defaultChart, {id:"48h", name:"48h"}, {id:"1w", name:"Nädal"}, {id:"1m", name:"Kuu"}, {id:"3m", name:"3 Kuud"}, {id:"1y", name:"Aasta"}];
    $scope.activeChartId = "";
    $scope.errorMsg = "";

    $scope.showChart = function(type) {
      $scope.activeChartId = type.id;
      $scope.errorMsg = "";
      TempChart.loadChart(type.id).catch(function(error) {
        if (error.status == 404) $scope.errorMsg = "Viga! Andmed puuduvad!";
        else $scope.errorMsg = "Viga! " + error.responseText;
      });
    };

    $scope.showChart(defaultChart);
  }]);

app.controller('RemoteCtrl', ['$scope', '$http', 'observeOnScope', 'rx', '$q',
  function ($scope, $http, observeOnScope, rx, $q) {
    $scope.isave = false;
    $scope.mode = "";
    var temperature = 21;
    $scope.alerts = [];
    getRemoteState().then(function() {
      var isaveObservable = observeOnScope($scope, 'isave').skip(1);
      rx.Observable.merge(disableIsaveObservable, isaveObservable).throttleFirst(500).subscribe(function () { sendState(); });
    });

    var increaseObservable = $scope.$createObservableFunction('increase')
        .map(function () { return temperature; })
        .filter(function (temp) { return temp < 30; })
        .map(function () { ++temperature; if (temperature < 16) temperature = 16; return setTemperature(temperature); })
        .debounce(500);

    var decreaseObservable = $scope.$createObservableFunction('decrease')
        .map(function () { return temperature; })
        .filter(function(temp) { return temp > 16; })
        .map(function() { --temperature; return setTemperature(temperature); })
        .debounce(500);

    var selectModeObservable = $scope.$createObservableFunction('selectMode')
        .map(function() { return $scope.mode; });

    var disableIsaveObservable = rx.Observable.merge(increaseObservable, decreaseObservable, selectModeObservable)
        .do(function () { $scope.isave = false; });

    $scope.closeAlert = function(index) {
      $scope.alerts.splice(index, 1);
    };

    function addInfoAlert(msg) {
      $scope.alerts.push({type:'success', msg: msg});
    }

    function addErrorAlert(msg) {
      $scope.alerts.push({type:'danger', msg: msg});
    }

    function finishRequest(data) {
      console.log(data);
      document.body.style.opacity = "1";
    }

    function sendState() {
      document.body.style.opacity = "0.5";
      $http.post("/remote", {temperature: temperature, mode:$scope.mode, isave:$scope.isave}).then(function(data) {
        finishRequest(data);
        setTemperature(data.data.temperature);
        $scope.isave = data.data.isave;
        console.log("$scope.isave", $scope.isave);
        $scope.mode = data.data.mode;
        addInfoAlert("Successfully updated!");
      }, function (error) {
        getRemoteState().then(
            function () { errorHandler(error); },
            function (secondError) { errorHandler(error); errorHandler(secondError); });
      });
    }

    function getRemoteState() {
      var d = $q.defer();
      $http.get("/remote").then(function (data) {
        finishRequest(data);
        setTemperature(data.data.temperature);
        $scope.isave = data.data.isave;
        $scope.mode = data.data.mode;
        d.resolve();
      }, function (error) {
        errorHandler(error);
        d.reject(error);
      });
      return d.promise;
    }

    function setTemperature(temp) {
      temperature = temp;
      $scope.temperature = temperature + "°C";
      return temperature;
    }

    function errorHandler(data) {
      finishRequest(data);
      addErrorAlert(data.data);
    }
  }]);