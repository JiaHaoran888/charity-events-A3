angular.module('adminApp', [])
.factory('adminApi', ['$http', function($http){
  return {
    listEvents: function(){ return $http.get('/api/events-admin'); },
    getEvent: function(id){ return $http.get('/api/events/' + id); },
    createEvent: function(data){ return $http.post('/api/events', data); },
    updateEvent: function(id,data){ return $http.put('/api/events/' + id, data); },
    deleteEvent: function(id){ return $http.delete('/api/events/' + id); },
    listRegs: function(){ return $http.get('/api/registrations'); }
  };
}])
.controller('AdminCtrl', ['$scope','adminApi', function($scope, adminApi){
  $scope.events = [];
  $scope.filteredEvents = [];
  $scope.selectedRegs = [];
  $scope.form = {};
  $scope.editId = null;
  $scope.drawerOpen = false;
  $scope.message = '';
  $scope.error = '';
  $scope.filterStatus = '';
  $scope.searchText = '';
  $scope.toDeleteId = null;

  function load(){
    adminApi.listEvents().then(function(res){ $scope.events = res.data || []; $scope.applyFilter(); });
    adminApi.listRegs().then(function(res){ $scope.allRegs = res.data || []; });
  }
  load();

  $scope.reload = function(){ load(); };

  $scope.applyFilter = function(){
    var items = ($scope.events || []).slice();
    if($scope.filterStatus){
      items = items.filter(function(i){ return String(i.status) === String($scope.filterStatus); });
    }
    if($scope.searchText){
      var q = $scope.searchText.toLowerCase();
      items = items.filter(function(i){ return (i.name && i.name.toLowerCase().indexOf(q)!==-1) || (i.location && i.location.toLowerCase().indexOf(q)!==-1); });
    }
    items.sort(function(a,b){ return new Date(b.event_date) - new Date(a.event_date); });
    $scope.filteredEvents = items;
  };

  $scope.openCreate = function(){
    $scope.editId = null;
    $scope.form = { org_id:1, category_id:1, status:'active', price:0, capacity:0, goal_amount:0 };
    $scope.selectedRegs = [];
    $scope.drawerOpen = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  $scope.edit = function(id){
    adminApi.getEvent(id).then(function(res){
      var ev = res.data;
      $scope.form = {
        org_id: ev.org_id,
        category_id: ev.category_id,
        name: ev.name,
        short_description: ev.short_description,
        description: ev.description,
        event_date: ev.event_date ? new Date(ev.event_date).toISOString().slice(0,16) : '',
        location: ev.location,
        address: ev.address,
        price: ev.price,
        capacity: ev.capacity,
        image_url: ev.image_url,
        goal_amount: ev.goal_amount,
        status: ev.status,
        latitude: ev.latitude,
        longitude: ev.longitude
      };
      $scope.editId = id;
      $scope.selectedRegs = ev.registrations || [];
      $scope.drawerOpen = true;
      setTimeout(function(){ window.scrollTo({ top: 0, behavior: 'smooth' }); }, 100);
    }, function(){ $scope.error = 'Failed to load event details'; });
  };

  $scope.confirmDelete = function(id){
    $scope.toDeleteId = id;
    var hasRegs = ($scope.allRegs || []).some(function(r){ return r.event_id == id; });
    if(hasRegs){ $scope.error = 'Cannot delete event because it has registrations.'; return; }
    if(confirm('Delete event? This cannot be undone.')){ $scope.doDelete(id); }
  };

  $scope.doDelete = function(id){
    adminApi.deleteEvent(id).then(function(){
      $scope.message = 'Event deleted';
      $scope.toDeleteId = null;
      load();
    }, function(err){
      $scope.toDeleteId = null;
      var m = (err.data && err.data.message) ? err.data.message : 'Delete failed';
      $scope.error = m;
    });
  };

  $scope.closeDrawer = function(){ $scope.drawerOpen = false; $scope.editId = null; $scope.form = {}; $scope.selectedRegs = []; };

  $scope.save = function(){
    if(!$scope.form.name || !$scope.form.event_date){ $scope.error = 'Please provide required fields: name and event date'; return; }
    var payload = {
      org_id: parseInt($scope.form.org_id || 1,10),
      category_id: parseInt($scope.form.category_id || 1,10),
      name: $scope.form.name,
      short_description: $scope.form.short_description,
      description: $scope.form.description,
      event_date: $scope.form.event_date ? new Date($scope.form.event_date).toISOString().slice(0,19).replace('T',' ') : null,
      location: $scope.form.location,
      address: $scope.form.address,
      price: parseFloat($scope.form.price || 0),
      capacity: parseInt($scope.form.capacity || 0,10),
      image_url: $scope.form.image_url,
      goal_amount: parseFloat($scope.form.goal_amount || 0),
      status: $scope.form.status,
      latitude: $scope.form.latitude,
      longitude: $scope.form.longitude
    };
    if($scope.editId){
      adminApi.updateEvent($scope.editId, payload).then(function(){ $scope.message = 'Event updated'; $scope.closeDrawer(); load(); }, function(err){ $scope.error = (err.data && err.data.message) ? err.data.message : 'Update failed'; });
    } else {
      adminApi.createEvent(payload).then(function(){ $scope.message = 'Event created'; $scope.closeDrawer(); load(); }, function(err){ $scope.error = (err.data && err.data.message) ? err.data.message : 'Create failed'; });
    }
  };

  $scope.reset = function(){ if($scope.editId) $scope.edit($scope.editId); else $scope.form = {}; $scope.selectedRegs = []; };

  $scope.clearAlerts = function(){ $scope.message = ''; $scope.error = ''; };

}]);
