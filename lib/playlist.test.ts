import {describe,expect,it} from 'vitest';
import {buildPlaylistPlan} from './playlist';

describe('buildPlaylistPlan',()=>{
  it('rebuilds the playlist when Mixroom is not the active playback context',()=>{
    expect(buildPlaylistPlan('room',['old'],['a','b'],null)).toEqual({prefix:[],uris:['a','b']});
  });

  it('preserves every item through the currently playing song and removes it from upcoming',()=>{
    const result=buildPlaylistPlan(
      'room',
      ['played','current','old-upcoming'],
      ['current','new-a','new-b'],
      {contextUri:'spotify:playlist:room',itemUri:'current'},
    );
    expect(result).toEqual({
      prefix:['played','current'],
      uris:['played','current','new-a','new-b'],
    });
  });

  it('does not duplicate the first song when it starts playing',()=>{
    expect(buildPlaylistPlan(
      'room',
      ['first','second'],
      ['first','second'],
      {contextUri:'spotify:playlist:room',itemUri:'first'},
    )).toEqual({
      prefix:['first'],
      uris:['first','second'],
    });
  });

  it('refuses to overwrite an active playlist when its current item is unknown',()=>{
    expect(()=>buildPlaylistPlan(
      'room',
      ['known'],
      ['new'],
      {contextUri:'spotify:playlist:room',itemUri:'external-edit'},
    )).toThrow(/stopped to protect playback/);
  });
});
