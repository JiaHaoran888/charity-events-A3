angular.module('charityApp', [])
.factory('apiService', ['$http', function($http){
  return {
    getHome: function(){ return $http.get('/api/home'); },
    getCategories: function(){ return $http.get('/api/categories'); },
    search: function(params){ return $http.get('/api/search', { params: params }); },
    getEvent: function(id){ return $http.get('/api/events/' + id); },
    register: function(data){ return $http.post('/api/registrations', data); }
  };
}])
.factory('weatherService', ['$http', function($http){
  return {
    getDaily: function(lat, lon, tz){
      return $http.get('https://api.open-meteo.com/v1/forecast', { params: { latitude: lat, longitude: lon, daily: 'weather_code,temperature_2m_max,temperature_2m_min', timezone: tz } });
    }
  };
}])
.controller('HomeCtrl', ['$scope','apiService', function($scope, apiService){
  $scope.upcoming = [];
  $scope.popular = [];
  apiService.getHome().then(function(res){ $scope.upcoming = res.data.upcoming; $scope.popular = res.data.popular; });
  $scope.goEvent = function(id){ location.href = '/event.html?id=' + id; };
}])
.controller('SearchCtrl', ['$scope','apiService', function($scope, apiService){
  $scope.categories = [];
  $scope.results = [];
  $scope.form = {};
  $scope.noResults = false;
  apiService.getCategories().then(function(res){ $scope.categories = res.data; });
  $scope.search = function(){
    var params = {};
    if($scope.form.date) params.date = $scope.form.date;
    if($scope.form.location) params.location = $scope.form.location;
    if($scope.form.category) params.category = $scope.form.category;
    apiService.search(params).then(function(res){
      $scope.results = res.data;
      $scope.noResults = !$scope.results || $scope.results.length === 0;
    }, function(){ $scope.results = []; $scope.noResults = true; });
  };
  $scope.clear = function(){ $scope.form = {}; $scope.results = []; $scope.noResults = false; };
}])
.controller('EventCtrl', ['$scope','apiService','weatherService', function($scope, apiService, weatherService){
  $scope.event = null;
  var url = new URL(location.href);
  var id = url.searchParams.get('id');
  if(!id){ $scope.event = null; return; }
  apiService.getEvent(id).then(function(res){
    $scope.event = res.data;
    if($scope.event.latitude && $scope.event.longitude){
      var tz = 'Australia/Sydney';
      weatherService.getDaily($scope.event.latitude, $scope.event.longitude, tz).then(function(wr){
        $scope.weather = wr.data;
      }, function(){ $scope.weather = null; });
    } else {
      $scope.weather = null;
    }
  }, function(){ $scope.event = null; });
  $scope.goRegister = function(){ location.href = '/register.html?id=' + id; };
}])
.controller('RegisterCtrl', ['$scope','apiService', function($scope, apiService){
  $scope.event = null;
  $scope.form = { name:'', email:'', phone:'', tickets:1 };
  $scope.message = '';
  $scope.error = '';
  var url = new URL(location.href);
  var id = url.searchParams.get('id');
  if(id){
    apiService.getEvent(id).then(function(res){ $scope.event = res.data; }, function(){ $scope.event = null; });
  }
  $scope.submit = function(){
    $scope.message = '';
    $scope.error = '';
    if(!$scope.form.name || !$scope.form.email || !$scope.form.tickets || $scope.form.tickets < 1){ $scope.error = 'Please provide valid name, email and ticket count.'; return; }
    var payload = { event_id: id, name: $scope.form.name, contact_email: $scope.form.email, phone: $scope.form.phone, number_of_tickets: $scope.form.tickets };
    apiService.register(payload).then(function(res){
      $scope.message = 'Registration successful. Redirecting...';
      setTimeout(function(){ location.href = '/event.html?id=' + id; }, 1400);
    }, function(err){
      $scope.error = (err.data && err.data.message) ? err.data.message : 'Registration failed';
    });
  };
  $scope.cancel = function(){ if(id) location.href = '/event.html?id=' + id; else location.href = '/'; };
}]);
