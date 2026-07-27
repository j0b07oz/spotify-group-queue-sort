import {describe,it,expect} from 'vitest'; import {mix} from './queue';
const item=(id:string,artist:string,energy:number)=>({id,name:id,uri:`spotify:track:${id}`,artists:[artist],artist_ids:[artist],album:'x',image_url:null,release_year:2020,duration_ms:1,genres:[],danceability:.5,acousticness:.5,energy,tempo:120,key_num:1,mode:1,time_signature:4,valence:.5,submission_id:id,guest_name:'g',position:0,pinned:false,state:'upcoming'});
describe('mix',()=>{
  it('keeps all tracks and spaces duplicate artists',()=>{
    const result=mix([item('a','same',.1),item('b','same',.2),item('c','other',.9)]);
    expect(result.map(x=>x.id)).toEqual(['a','c','b']);
  });
  it('assigns sequential positions',()=>expect(mix([item('a','a',.1),item('b','b',.2)]).map(x=>x.position)).toEqual([0,1]));
  it('preserves manually pinned positions while sorting the rest',()=>{
    const a=item('a','a',.1),b={...item('b','b',.2),position:1,pinned:true},c=item('c','c',.3);
    const result=mix([a,b,c]);
    expect(result[1].id).toBe('b');
    expect(result[1].pinned).toBe(true);
  });
  it('does not mutate its input',()=>{
    const items=[item('a','a',.1),item('b','b',.2),item('c','c',.3)];
    const snapshot=structuredClone(items);
    mix(items);
    expect(items).toEqual(snapshot);
  });
});
