app.factory('TempChart', ['$http', '$q',
  function($http, $q){
    var service = {};
    var chart;
    var chartType;
    Highcharts.setOptions({
      global: {
        useUTC: false
      }
    });

    var options = {
      chart: {
        renderTo: 'chart',
        type: 'spline'
      },
      title: {
        text: 'Temperatures of the last 24h'
      },
      subtitle: {
        text: ''
      },
      colors: ['#4572A7', '#AA4643', '#89A54E', '#80699B', '#3D96AE', '#DB843D', '#92A8CD', '#A47D7C', '#B5CA92'],
      xAxis: {
        type: 'datetime',
        dateTimeLabelFormats: {
          hour: '%H. %M'
        }
      },
      yAxis: {
        title: {
          text: 'T (°C)'
        }
      },
      tooltip: {
        formatter: function () {
          return '<b>' + this.series.name + '</b><br/>' + Highcharts.dateFormat('%H:%M', this.x) + ': ' + this.y.toFixed(1) + '°C';
        }
      },

      plotOptions: {
        series: {
          marker: {
            radius: 2
          }
        }
      },

      lineWidth: 1,

      series: []
    };

    function errorHandler(error) {
      if (chart !== undefined) {
        chart.destroy();
        chart = undefined;
      }
    }

    function initChart(xml) {
      options.series = [];

      $(xml).find("entry").each(function () {
        var seriesOptions = {
          name: $(this).text(),
          data: []
        };
        options.series.push(seriesOptions);
      });

      $(xml).find("row").each(function () {
        var t = parseInt($(this).find("t").text()) * 1000;

        $(this).find("v").each(function (index) {
          var v = parseFloat($(this).text());
          v = v || null;
          if (v != null) {
            options.series[index].data.push([t, v])
          }
        });
      });

      options.title.text = getChartTitle();
      //$.each(series, function (index) {
      //  options.series.push(series[index]);
      //});

      if (chart === undefined) chart = new Highcharts.Chart(options);
      else {
        chart.destroy();
        chart = new Highcharts.Chart(options);
      }
    }

    function getChartTitle() {
      switch (chartType) {
        case "3h":
          return "Viimased 3 tundi";
        case "48h":
          return "Viimased 48 tundi";
        case "1w":
          return "Viimane nädal";
        case "1m":
          return "Viimane kuu";
        case "3m":
          return "Viimased 3 kuud";
        case "1y":
          return "Viimane aasta";
        case "1yminmax":
          return "Viimase aasta miinimum-maksimum";
        default:
          return "Viimased 24 tundi";
      }
    }

    function getDataURL() {
      var urlPath = "temperature";
      switch (chartType) {
        case "3h":
        case "48h":
        case "1w":
        case "1m":
        case "3m":
        case "1y":
        case "1yminmax":
          return "data/" + urlPath + chartType + ".xml";
      }
      return "data/" + urlPath + "24h.xml";
    }

    service.loadChart = function(type) {
      chartType = type;
      var deferred = $q.defer();
      $http.get(getDataURL()).then(function(response) {
        initChart(response.data);
        deferred.resolve();
      }, function(error) {
        errorHandler(error);
        deferred.reject(error);
      });
      return deferred.promise;
    };

    return service;
  }]);