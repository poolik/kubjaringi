urlPath = "temperature";

// return everything after the question mark
function GetUrlParameter() {
  var idx = window.location.href.indexOf("?");
  if (idx < 0) return "24h";
  return window.location.href.substring(idx + 1);
}

/**
 * @return {string}
 */
function GetChartXml() {
  var urlParameter = GetUrlParameter();
  var $temp = $(".temp-menu");
  $temp.find("a").removeClass("active");
  $temp.find("."+urlParameter).addClass("active");
  switch (GetUrlParameter()) {
    case "3h":
    case "48h":
    case "1w":
    case "1m":
    case "3m":
    case "1y":
    case "1yminmax":
      return "data/" + urlPath + urlParameter + ".xml";
  }
  return "data/" + urlPath + "24h.xml";
}

/**
 * @return {string}
 */
function GetChartTitle() {
  var urlParameter = GetUrlParameter();
  switch (urlParameter) {
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

Highcharts.setOptions({
  global: {
    useUTC: false
  }
});

options = {
  chart: {
    renderTo: 'content',
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

$(document).ready(function () {

  $.ajax({
    type: "GET",
    url: GetChartXml(),
    dataType: "xml",
    success: function (xml) {
      var series = [];

      //define series
      $(xml).find("entry").each(function () {
        var seriesOptions = {
          name: $(this).text(),
          data: []
        };
        options.series.push(seriesOptions);
      });

      //populate with data
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

      options.title.text = GetChartTitle();
      $.each(series, function (index) {
        options.series.push(series[index]);
      });

      var chart = new Highcharts.Chart(options);
    },
    error: function(error) {
      console.log("ERROR:", error);
      if (error.status == 404) $("#content").text("Viga! Andmed puuduvad!");
      else $("#content").text("Viga! " + error.responseText);
    }
  });
});
